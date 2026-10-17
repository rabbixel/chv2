<?php
/**
 * Verified-email claiming for legacy guest EDD customers.
 *
 * @package CreativeHattiAPI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class CH_Claim_Controller {
	private const TOKEN_TTL          = 30 * MINUTE_IN_SECONDS;
	private const LIMIT_WINDOW       = HOUR_IN_SECONDS;
	private const MAX_REQUESTS_IP    = 20;
	private const MAX_REQUESTS_EMAIL = 5;
	private const MAX_VERIFY_IP      = 20;

	/**
	 * Auth bridge used to validate the private Next.js server.
	 *
	 * @var CH_Auth_Controller
	 */
	private $auth_controller;

	public function __construct( $auth_controller ) {
		$this->auth_controller = $auth_controller;
	}

	public function register_routes() {
		register_rest_route(
			CH_API::NAMESPACE,
			'/customer/claim/request',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'request_claim' ),
				'permission_callback' => array( $this, 'bridge_permission' ),
				'args'                => array(
					'email'          => array( 'type' => 'string', 'required' => true ),
					'frontend_origin' => array( 'type' => 'string', 'required' => true ),
				),
			)
		);

		register_rest_route(
			CH_API::NAMESPACE,
			'/customer/claim/complete',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'complete_claim' ),
				'permission_callback' => array( $this, 'bridge_permission' ),
				'args'                => array(
					'token'      => array( 'type' => 'string', 'required' => true ),
					'first_name' => array( 'type' => 'string' ),
					'last_name'  => array( 'type' => 'string' ),
					'password'   => array( 'type' => 'string' ),
				),
			)
		);
	}

	public function bridge_permission( $request ) {
		return $this->auth_controller->bridge_permission( $request );
	}

	/** Always return the same accepted response; eligibility is private. */
	public function request_claim( $request ) {
		$email_param = $request->get_param( 'email' );
		$email       = strtolower( trim( sanitize_email( is_string( $email_param ) ? $email_param : '' ) ) );
		$ip          = $this->client_ip();
		$email_key   = self::limit_key( 'request-email', $email );
		$ip_key      = self::limit_key( 'request-ip', $ip );

		$ip_allowed    = self::take_rate_limit( $ip_key, self::MAX_REQUESTS_IP, self::LIMIT_WINDOW );
		$email_allowed = self::take_rate_limit( $email_key, self::MAX_REQUESTS_EMAIL, self::LIMIT_WINDOW );
		if ( ! $ip_allowed || ! $email_allowed || ! is_email( $email ) ) {
			return self::request_accepted();
		}

		$customer = $this->find_single_unlinked_primary_customer( $email );
		if ( ! $customer ) {
			return self::request_accepted();
		}

		try {
			$token      = bin2hex( random_bytes( 32 ) );
			$token_hash = hash( 'sha256', $token );
		} catch ( Throwable $error ) {
			return self::request_accepted();
		}

		$token_record = array(
			'customer_id' => (int) $customer->id,
			'email_hash'  => hash( 'sha256', $email ),
			'expires_at'  => time() + self::TOKEN_TTL,
		);
		set_transient( self::token_transient_key( $token_hash ), $token_record, self::TOKEN_TTL );

		$frontend_url = self::frontend_url( $request->get_param( 'frontend_origin' ) );
		if ( '' === $frontend_url ) {
			delete_transient( self::token_transient_key( $token_hash ) );
			return self::request_accepted();
		}

		$verification_url = $frontend_url . '/claim-account/verify#' . $token;
		$subject          = 'Verify your Creative Hatti account';
		$message          = "Someone requested access to historical Creative Hatti purchases associated with this email address.\n\n";
		$message         .= "To verify this email and continue, open this link within 30 minutes:\n";
		$message         .= $verification_url . "\n\n";
		$message         .= "If you did not request this, you can ignore this email. No account changes have been made.";

		if ( ! wp_mail( $email, $subject, $message ) ) {
			delete_transient( self::token_transient_key( $token_hash ) );
		}

		return self::request_accepted();
	}

	/** Complete a claim only after email-token and WordPress-user checks pass. */
	public function complete_claim( $request ) {
		$ip = $this->client_ip();
		if ( ! self::take_rate_limit( self::limit_key( 'verify-ip', $ip ), self::MAX_VERIFY_IP, self::LIMIT_WINDOW ) ) {
			return self::invalid_claim();
		}

		$token = $request->get_param( 'token' );
		if ( ! is_string( $token ) || ! preg_match( '/^[a-f0-9]{64}$/D', $token ) ) {
			return self::invalid_claim();
		}

		$token_hash = hash( 'sha256', $token );
		$transient_key = self::token_transient_key( $token_hash );
		$token_record  = get_transient( $transient_key );
		if ( ! is_array( $token_record ) || empty( $token_record['customer_id'] ) || empty( $token_record['email_hash'] ) || empty( $token_record['expires_at'] ) || (int) $token_record['expires_at'] < time() ) {
			return self::invalid_claim();
		}

		$user = $this->authenticated_user( $request );
		if ( is_wp_error( $user ) ) {
			return self::invalid_claim();
		}

		global $wpdb;
		$customers_table = $wpdb->prefix . 'edd_customers';
		$lock_name       = $user
			? 'ch_claim_user_' . (int) $user->ID
			: 'ch_claim_email_' . substr( (string) $token_record['email_hash'], 0, 40 );
		$lock_acquired   = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 8)', $lock_name ) );
		if ( 1 !== $lock_acquired ) {
			return self::invalid_claim();
		}

		$transaction_open = false;
		try {
			if ( false === $wpdb->query( 'START TRANSACTION' ) ) {
				return self::invalid_claim();
			}
			$transaction_open = true;

			$customer = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT id, user_id, email, name, status FROM {$customers_table} WHERE id = %d FOR UPDATE",
					(int) $token_record['customer_id']
				)
			);
			if ( ! $customer || 'active' !== $customer->status || (int) $customer->user_id > 0 || ! hash_equals( (string) $token_record['email_hash'], hash( 'sha256', strtolower( trim( (string) $customer->email ) ) ) ) ) {
				$wpdb->query( 'ROLLBACK' );
				$transaction_open = false;
				return self::invalid_claim();
			}

			$email = strtolower( trim( (string) $customer->email ) );
			$email_matches = (int) $wpdb->get_var(
				$wpdb->prepare( "SELECT COUNT(ID) FROM {$wpdb->users} WHERE LOWER(user_email) = %s", $email )
			);

			if ( $user ) {
				if ( ! hash_equals( $email, strtolower( trim( (string) $user->user_email ) ) ) || 1 !== $email_matches ) {
					$wpdb->query( 'ROLLBACK' );
					$transaction_open = false;
					return self::account_conflict();
				}
			} elseif ( $email_matches > 0 ) {
				$wpdb->query( 'ROLLBACK' );
				$transaction_open = false;
				return CH_API::error( 'claim_login_required', 'Sign in to the account that uses this verified email, then continue.', 409 );
			} else {
				$user = $this->create_wordpress_user( $request, $email, (string) $customer->name );
				if ( is_wp_error( $user ) ) {
					$wpdb->query( 'ROLLBACK' );
					$transaction_open = false;
					return self::account_conflict();
				}
				wp_set_current_user( (int) $user->ID );
			}

			$other_customer_id = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT id FROM {$customers_table} WHERE user_id = %d AND id <> %d LIMIT 1 FOR UPDATE",
					(int) $user->ID,
					(int) $customer->id
				)
			);
			if ( $other_customer_id ) {
				$wpdb->query( 'ROLLBACK' );
				$transaction_open = false;
				return self::account_conflict();
			}

			$edd_customer = function_exists( 'edd_get_customer' ) ? edd_get_customer( (int) $customer->id ) : false;
			if ( ! $edd_customer || ! $edd_customer->update( array( 'user_id' => (int) $user->ID ) ) ) {
				$wpdb->query( 'ROLLBACK' );
				$transaction_open = false;
				return self::account_conflict();
			}

			if ( false === $wpdb->query( 'COMMIT' ) ) {
				$wpdb->query( 'ROLLBACK' );
				$transaction_open = false;
				return self::account_conflict();
			}
			$transaction_open = false;
			delete_transient( $transient_key );

			$session = null;
			if ( ! $this->authenticated_user( $request ) ) {
				$expiration = time() + 12 * HOUR_IN_SECONDS;
				$session = array(
					'user_id'    => (int) $user->ID,
					'token'      => WP_Session_Tokens::get_instance( (int) $user->ID )->create( $expiration ),
					'expires_at' => gmdate( 'c', $expiration ),
				);
			}

			return CH_API::success(
				array(
					'linked'  => true,
					'session' => $session,
					'user'    => CH_Auth_Controller::profile_for_claim( $user ),
				)
			);
		} catch ( Throwable $error ) {
			if ( $transaction_open ) {
				$wpdb->query( 'ROLLBACK' );
			}
			return self::account_conflict();
		} finally {
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
		}
	}

	private function find_single_unlinked_primary_customer( $email ) {
		global $wpdb;
		$customers_table  = $wpdb->prefix . 'edd_customers';
		$addresses_table  = $wpdb->prefix . 'edd_customer_email_addresses';
		$matches = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT customer_id FROM (
					SELECT id AS customer_id FROM {$customers_table} WHERE LOWER(email) = %s
					UNION
					SELECT customer_id FROM {$addresses_table} WHERE LOWER(email) = %s AND status = 'active'
				) AS email_matches",
				$email,
				$email
			)
		);
		if ( ! is_array( $matches ) || 1 !== count( $matches ) ) {
			return false;
		}

		$customer = $wpdb->get_row(
			$wpdb->prepare( "SELECT id, user_id, email, name, status FROM {$customers_table} WHERE id = %d", (int) $matches[0] )
		);
		if ( ! $customer || 'active' !== $customer->status || (int) $customer->user_id > 0 || ! hash_equals( $email, strtolower( trim( (string) $customer->email ) ) ) ) {
			return false;
		}

		return $customer;
	}

	private function create_wordpress_user( $request, $email, $edd_name ) {
		$password_param = $request->get_param( 'password' );
		$password       = is_string( $password_param ) ? $password_param : '';
		$first_param    = $request->get_param( 'first_name' );
		$last_param     = $request->get_param( 'last_name' );
		$first_name     = sanitize_text_field( is_string( $first_param ) ? $first_param : '' );
		$last_name      = sanitize_text_field( is_string( $last_param ) ? $last_param : '' );

		if ( ! CH_Auth_Controller::is_strong_password( $password ) ) {
			return new WP_Error( 'claim_invalid_password', 'Invalid account details.' );
		}
		if ( '' === $first_name && '' === $last_name ) {
			$parts      = preg_split( '/\s+/', trim( sanitize_text_field( $edd_name ) ), 2 );
			$first_name = isset( $parts[0] ) ? $parts[0] : '';
			$last_name  = isset( $parts[1] ) ? $parts[1] : '';
		}
		if ( '' === $first_name ) {
			return new WP_Error( 'claim_invalid_name', 'Invalid account details.' );
		}

		$local_part = strstr( $email, '@', true );
		$user_login = sanitize_user( (string) $local_part, true );
		if ( strlen( $user_login ) < 3 ) {
			$user_login = 'ch_customer_' . substr( hash( 'sha256', $email ), 0, 12 );
		}
		if ( username_exists( $user_login ) ) {
			$user_login .= '_' . strtolower( wp_generate_password( 8, false, false ) );
		}

		$user_id = wp_insert_user(
			array(
				'user_login' => $user_login,
				'user_email' => $email,
				'user_pass'  => $password,
				'first_name' => $first_name,
				'last_name'  => $last_name,
				'role'       => 'subscriber',
			)
		);

		return is_wp_error( $user_id ) ? $user_id : get_user_by( 'id', (int) $user_id );
	}

	private function authenticated_user( $request ) {
		$authorization = (string) $request->get_header( 'authorization' );
		if ( '' === $authorization ) {
			return false;
		}

		if ( ! preg_match( '/^Bearer ([1-9][0-9]*)\.([A-Za-z0-9]{43})$/D', $authorization, $matches ) ) {
			return new WP_Error( 'invalid_session', 'Authentication required.' );
		}

		$user_id = absint( $matches[1] );
		$user    = get_user_by( 'id', $user_id );
		if ( ! $user || ! WP_Session_Tokens::get_instance( $user_id )->verify( $matches[2] ) ) {
			return new WP_Error( 'invalid_session', 'Authentication required.' );
		}

		wp_set_current_user( $user_id );
		return $user;
	}

	private function client_ip() {
		return isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
	}

	private static function request_accepted() {
		return CH_API::success( array( 'message' => 'If an eligible purchase record is associated with that email, a verification link is on its way.' ), 202 );
	}

	private static function invalid_claim() {
		return CH_API::error( 'invalid_claim', 'This verification link is invalid or has expired. Request a new link and try again.', 400 );
	}

	private static function account_conflict() {
		return CH_API::error( 'claim_conflict', 'We could not link this purchase record to the signed-in account. Contact support for help.', 409 );
	}

	private static function token_transient_key( $token_hash ) {
		return 'ch_claim_token_' . $token_hash;
	}

	private static function limit_key( $purpose, $value ) {
		return 'ch_claim_' . $purpose . '_' . hash_hmac( 'sha256', (string) $value, wp_salt( 'auth' ) );
	}

	private static function take_rate_limit( $key, $limit, $ttl ) {
		global $wpdb;
		$lock_name = 'ch_claim_rl_' . substr( hash( 'sha256', $key ), 0, 40 );
		if ( 1 !== (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 3)', $lock_name ) ) ) {
			return false;
		}

		try {
			$count = (int) get_transient( $key );
			set_transient( $key, $count + 1, $ttl );
			return $count < $limit;
		} finally {
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
		}
	}

	private static function frontend_url( $origin ) {
		$url = is_string( $origin ) ? rtrim( trim( $origin ), '/' ) : '';
		if ( '' === $url ) {
			return '';
		}
		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) || empty( $parts['host'] ) || ! in_array( $parts['scheme'] ?? '', array( 'http', 'https' ), true ) || isset( $parts['user'] ) || isset( $parts['pass'] ) || isset( $parts['query'] ) || isset( $parts['fragment'] ) || ! in_array( $parts['path'] ?? '', array( '', '/' ), true ) ) {
			return '';
		}
		if ( 'production' === wp_get_environment_type() && 'https' !== $parts['scheme'] ) {
			return '';
		}
		return $url;
	}
}
