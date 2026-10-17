<?php
/**
 * Private account authentication endpoints for the Next.js server bridge.
 *
 * @package CreativeHattiAPI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class CH_Auth_Controller {
	private const SESSION_TTL       = 12 * HOUR_IN_SECONDS;
	private const REMEMBER_TTL      = 30 * DAY_IN_SECONDS;
	private const LOGIN_WINDOW      = 15 * MINUTE_IN_SECONDS;
	private const MAX_LOGIN_ATTEMPTS = 8;
	private const VERIFICATION_TTL   = 30 * MINUTE_IN_SECONDS;
	private const RESET_TTL         = DAY_IN_SECONDS;
	private const ACTION_LIMIT_IP   = 20;
	private const ACTION_LIMIT_EMAIL = 5;
	private const EMAIL_VERIFIED_META = '_ch_email_verified';

	public function __construct() {
		add_filter( 'wp_authenticate_user', array( $this, 'reject_unverified_user' ), 30, 2 );
		add_filter( 'rest_post_dispatch', array( $this, 'disable_auth_response_caching' ), 10, 3 );
	}

	/** Prevent pending registrations from authenticating through core WordPress login too. */
	public function reject_unverified_user( $user, $password = '' ) {
		if ( $user instanceof WP_User && '0' === (string) get_user_meta( $user->ID, self::EMAIL_VERIFIED_META, true ) ) {
			return new WP_Error( 'ch_email_not_verified', 'Verify your email address before signing in.' );
		}
		return $user;
	}

	public function register_routes() {
		register_rest_route(
			CH_API::NAMESPACE,
			'/auth/login',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'login' ),
				'permission_callback' => array( $this, 'bridge_permission' ),
				'args'                => array(
					'email'    => array( 'type' => 'string', 'required' => true ),
					'password' => array( 'type' => 'string', 'required' => true ),
					'remember' => array( 'type' => 'boolean', 'default' => false ),
				),
			)
		);

		foreach ( array(
			'/auth/register'          => array( 'callback' => 'register_account', 'args' => array( 'name' => array( 'type' => 'string', 'required' => true ), 'email' => array( 'type' => 'string', 'required' => true ), 'password' => array( 'type' => 'string', 'required' => true ), 'frontend_origin' => array( 'type' => 'string', 'required' => true ) ) ),
			'/auth/verify-email'      => array( 'callback' => 'verify_email', 'args' => array( 'token' => array( 'type' => 'string', 'required' => true ) ) ),
			'/auth/resend-activation' => array( 'callback' => 'resend_activation', 'args' => array( 'email' => array( 'type' => 'string', 'required' => true ), 'frontend_origin' => array( 'type' => 'string', 'required' => true ) ) ),
			'/auth/forgot-password'  => array( 'callback' => 'forgot_password', 'args' => array( 'email' => array( 'type' => 'string', 'required' => true ), 'frontend_origin' => array( 'type' => 'string', 'required' => true ) ) ),
			'/auth/reset-password'   => array( 'callback' => 'reset_password', 'args' => array( 'token' => array( 'type' => 'string', 'required' => true ), 'password' => array( 'type' => 'string', 'required' => true ) ) ),
		) as $route => $definition ) {
			register_rest_route(
				CH_API::NAMESPACE,
				$route,
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, $definition['callback'] ),
					'permission_callback' => array( $this, 'bridge_permission' ),
					'args'                => $definition['args'],
				)
			);
		}

		register_rest_route(
			CH_API::NAMESPACE,
			'/auth/logout',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'logout' ),
				'permission_callback' => array( $this, 'session_permission' ),
			)
		);

		register_rest_route(
			CH_API::NAMESPACE,
			'/customer/me',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'current_customer' ),
				'permission_callback' => array( $this, 'session_permission' ),
			)
		);
	}

	/** Only the trusted Next.js server may submit credentials or session tokens. */
	public function bridge_permission( $request ) {
		if ( ! self::is_secure_transport() ) {
			return new WP_Error( 'https_required', 'Authentication requires HTTPS.', array( 'status' => 403 ) );
		}

		$expected = self::bridge_secret();
		$provided = (string) $request->get_header( 'x-ch-auth-bridge' );

		if ( strlen( $expected ) < 32 || '' === $provided || ! hash_equals( $expected, $provided ) ) {
			return new WP_Error( 'auth_bridge_unavailable', 'Authentication service unavailable.', array( 'status' => 503 ) );
		}

		return true;
	}

	/** Verify the revocable WordPress session token supplied only by the BFF. */
	public function session_permission( $request ) {
		$bridge = $this->bridge_permission( $request );
		if ( true !== $bridge ) {
			return $bridge;
		}

		$authorization = (string) $request->get_header( 'authorization' );
		if ( ! preg_match( '/^Bearer ([1-9][0-9]*)\.([A-Za-z0-9]{43})$/D', $authorization, $matches ) ) {
			return new WP_Error( 'invalid_session', 'Authentication required.', array( 'status' => 401 ) );
		}

		$user_id = absint( $matches[1] );
		$user    = get_user_by( 'id', $user_id );
		if ( ! $user || ! WP_Session_Tokens::get_instance( $user_id )->verify( $matches[2] ) ) {
			return new WP_Error( 'invalid_session', 'Authentication required.', array( 'status' => 401 ) );
		}
		if ( '0' === (string) get_user_meta( $user_id, self::EMAIL_VERIFIED_META, true ) ) {
			return new WP_Error( 'email_not_verified', 'Verify your email address to continue.', array( 'status' => 403 ) );
		}

		wp_set_current_user( $user_id );
		$request->set_param( '_ch_session_token', $matches[2] );
		return true;
	}

	/** Safe profile shape for the private claim response. */
	public static function profile_for_claim( $user ) {
		return self::safe_profile( $user );
	}

	public function login( $request ) {
	$email_param = $request->get_param( 'email' );
	$password_param = $request->get_param( 'password' );
	$email    = strtolower( trim( sanitize_email( is_string( $email_param ) ? $email_param : '' ) ) );
	$password = is_string( $password_param ) ? $password_param : '';
		$ip       = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
		$keys     = self::rate_limit_keys( $ip, $email );

		if ( self::is_rate_limited( $keys ) ) {
			$response = CH_API::error( 'rate_limited', 'Too many attempts. Please try again later.', 429 );
			$response->header( 'Retry-After', (string) self::LOGIN_WINDOW );
			return $response;
		}

		if ( '' === $email || '' === $password || strlen( $password ) > 4096 ) {
			self::record_failed_attempt( $keys );
			return self::invalid_credentials();
		}

		global $wpdb;
		$email_matches = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(ID) FROM {$wpdb->users} WHERE user_email = %s", $email )
		);
		$user = 1 === $email_matches ? get_user_by( 'email', $email ) : false;
		$authenticated = $user ? wp_authenticate( $user->user_login, $password ) : false;

		if ( ! $authenticated || is_wp_error( $authenticated ) || ! ( $authenticated instanceof WP_User ) || '0' === (string) get_user_meta( $authenticated->ID, self::EMAIL_VERIFIED_META, true ) ) {
			self::record_failed_attempt( $keys );
			return self::invalid_credentials();
		}

		$remember   = (bool) $request->get_param( 'remember' );
		$expiration = time() + ( $remember ? self::REMEMBER_TTL : self::SESSION_TTL );
		$token      = WP_Session_Tokens::get_instance( $authenticated->ID )->create( $expiration );

		self::clear_login_rate_limit( $keys );

		return CH_API::success(
			array(
				'session' => array(
					'user_id'    => (int) $authenticated->ID,
					'token'      => $token,
					'expires_at' => gmdate( 'c', $expiration ),
			),
				'user'    => self::safe_profile( $authenticated ),
			)
		);
	}

	/** Create an email-pending WordPress account without revealing duplicate emails. */
	public function register_account( $request ) {
		$email_param    = $request->get_param( 'email' );
		$name_param     = $request->get_param( 'name' );
		$password_param = $request->get_param( 'password' );
		$email          = strtolower( trim( sanitize_email( is_string( $email_param ) ? $email_param : '' ) ) );
		$name           = sanitize_text_field( is_string( $name_param ) ? $name_param : '' );
		$password       = is_string( $password_param ) ? $password_param : '';
		$ip             = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';

		if ( ! $this->allow_email_action( 'register', $ip, $email ) ) {
			return self::rate_limited();
		}
		if ( ! is_email( $email ) ) {
			return CH_API::error( 'invalid_email', 'Enter a valid email address.', 400 );
		}
		if ( strlen( $name ) < 2 || strlen( $name ) > 150 ) {
			return CH_API::error( 'invalid_name', 'Enter a name between 2 and 150 characters.', 400 );
		}
		if ( ! self::is_strong_password( $password ) ) {
			return CH_API::error( 'weak_password', 'Password must be at least 12 characters and meet at least 3 of the 4 character requirements.', 400 );
		}
		$frontend_url = self::validated_frontend_url( $request->get_param( 'frontend_origin' ) );
		if ( ! $frontend_url ) {
			return self::registration_accepted();
		}

		global $wpdb;
		$lock_name = 'ch_auth_registration_' . substr( hash_hmac( 'sha256', $email, wp_salt( 'auth' ) ), 0, 32 );
		if ( 1 !== (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 3)', $lock_name ) ) ) {
			return self::registration_accepted();
		}
		try {
			return $this->create_registered_account( $email, $name, $password, $frontend_url );
		} finally {
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
		}
	}

	private function create_registered_account( $email, $name, $password, $frontend_url ) {
		global $wpdb;
		$email_count = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(ID) FROM {$wpdb->users} WHERE LOWER(user_email) = %s", $email ) );
		if ( 1 === $email_count ) {
			$existing = get_user_by( 'email', $email );
			if ( $existing && '0' === (string) get_user_meta( $existing->ID, self::EMAIL_VERIFIED_META, true ) ) {
				$this->send_capability_email( $existing, 'verify', $frontend_url );
			}
			return self::registration_accepted();
		}
		if ( 0 !== $email_count ) {
			return self::registration_accepted();
		}

		$parts      = preg_split( '/\s+/', trim( $name ), 2 );
		$first_name = isset( $parts[0] ) ? $parts[0] : '';
		$last_name  = isset( $parts[1] ) ? $parts[1] : '';
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
				// Keep the submitted password unusable until the pending marker is in place.
				'user_pass'  => wp_generate_password( 64, true, true ),
				'first_name' => $first_name,
				'last_name'  => $last_name,
				'role'       => 'subscriber',
			)
		);
		if ( is_wp_error( $user_id ) || ! $user_id ) {
			return self::registration_accepted();
		}

		update_user_meta( (int) $user_id, self::EMAIL_VERIFIED_META, '0' );
		wp_set_password( $password, (int) $user_id );
		$user = get_user_by( 'id', (int) $user_id );
		if ( $user ) {
			$this->send_capability_email( $user, 'verify', $frontend_url );
		}

		return self::registration_accepted();
	}

	/** A valid email capability activates the account and establishes a session. */
	public function verify_email( $request ) {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
		if ( ! $this->allow_ip_action( 'verify', $ip ) ) {
			return self::rate_limited();
		}
		$had_session = '' !== (string) $request->get_header( 'authorization' );
		if ( $had_session && true !== $this->session_permission( $request ) ) {
			$had_session = false;
		}
		$token = $request->get_param( 'token' );
		$lock  = $this->lock_capability( 'verify', $token );
		if ( ! $lock ) {
			return self::invalid_capability( 'email_verification' );
		}

		try {
			$record = get_transient( $lock['transient'] );
			$user   = is_array( $record ) && ! empty( $record['user_id'] ) ? get_user_by( 'id', (int) $record['user_id'] ) : false;
			if ( ! $this->valid_capability_record( $record, $user ) || '0' !== (string) get_user_meta( $user->ID, self::EMAIL_VERIFIED_META, true ) ) {
				return self::invalid_capability( 'email_verification' );
			}
			update_user_meta( $user->ID, self::EMAIL_VERIFIED_META, '1' );
			delete_transient( $lock['transient'] );
			$session = null;
			if ( ! $had_session ) {
				$expiration = time() + self::SESSION_TTL;
				$session    = array(
					'user_id'    => (int) $user->ID,
					'token'      => WP_Session_Tokens::get_instance( (int) $user->ID )->create( $expiration ),
					'expires_at' => gmdate( 'c', $expiration ),
				);
			}
			return CH_API::success( array( 'user' => self::safe_profile( $user ), 'session' => $session, 'current_user_matches' => ! $had_session || (int) get_current_user_id() === (int) $user->ID ) );
		} finally {
			$this->release_capability_lock( $lock );
		}
	}

	/** Re-send only to pending accounts while preserving an identical response. */
	public function resend_activation( $request ) {
		$email_param = $request->get_param( 'email' );
		$email       = strtolower( trim( sanitize_email( is_string( $email_param ) ? $email_param : '' ) ) );
		$ip          = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
		$frontend_url = self::validated_frontend_url( $request->get_param( 'frontend_origin' ) );
		if ( ! $this->allow_email_action( 'activation', $ip, $email ) ) {
			return self::rate_limited();
		}
		if ( is_email( $email ) ) {
			$user = get_user_by( 'email', $email );
			if ( $frontend_url && $user && '0' === (string) get_user_meta( $user->ID, self::EMAIL_VERIFIED_META, true ) ) {
				$this->send_capability_email( $user, 'verify', $frontend_url );
			}
		}
		return self::registration_accepted();
	}

	/** Issue an enumeration-safe, expiring password recovery email. */
	public function forgot_password( $request ) {
		$email_param = $request->get_param( 'email' );
		$email       = strtolower( trim( sanitize_email( is_string( $email_param ) ? $email_param : '' ) ) );
		$ip          = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
		$frontend_url = self::validated_frontend_url( $request->get_param( 'frontend_origin' ) );
		if ( ! $this->allow_email_action( 'reset_request', $ip, $email ) ) {
			return self::rate_limited();
		}
		if ( is_email( $email ) ) {
			global $wpdb;
			$email_count = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(ID) FROM {$wpdb->users} WHERE LOWER(user_email) = %s", $email ) );
			if ( 1 === $email_count ) {
				$user = get_user_by( 'email', $email );
				if ( $frontend_url && $user ) {
					$this->send_capability_email( $user, 'reset', $frontend_url );
				}
			}
		}
		return self::reset_accepted();
	}

	/** Replace the password once, activate email-verified pending accounts, and revoke sessions. */
	public function reset_password( $request ) {
		$password_param = $request->get_param( 'password' );
		$password       = is_string( $password_param ) ? $password_param : '';
		if ( ! self::is_strong_password( $password ) ) {
			return CH_API::error( 'weak_password', 'Password must be at least 12 characters and meet at least 3 of the 4 character requirements.', 400 );
		}
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
		if ( ! $this->allow_ip_action( 'reset', $ip ) ) {
			return self::rate_limited();
		}
		$token = $request->get_param( 'token' );
		$lock  = $this->lock_capability( 'reset', $token );
		if ( ! $lock ) {
			return self::invalid_capability( 'password_reset' );
		}

		try {
			$record = get_transient( $lock['transient'] );
			$user   = is_array( $record ) && ! empty( $record['user_id'] ) ? get_user_by( 'id', (int) $record['user_id'] ) : false;
			if ( ! $this->valid_capability_record( $record, $user ) ) {
				return self::invalid_capability( 'password_reset' );
			}
			wp_set_password( $password, (int) $user->ID );
			update_user_meta( $user->ID, self::EMAIL_VERIFIED_META, '1' );
			WP_Session_Tokens::get_instance( (int) $user->ID )->destroy_all();
			delete_transient( $lock['transient'] );
			return CH_API::success( array( 'password_reset' => true ) );
		} finally {
			$this->release_capability_lock( $lock );
		}
	}

	public function logout( $request ) {
		$user_id = get_current_user_id();
		$token   = (string) $request->get_param( '_ch_session_token' );

		if ( $user_id && '' !== $token ) {
			WP_Session_Tokens::get_instance( $user_id )->destroy( $token );
		}

		return CH_API::success( array( 'logged_out' => true ) );
	}

	public function current_customer() {
		$user     = wp_get_current_user();
		$customer = function_exists( 'edd_get_customer_by' )
			? edd_get_customer_by( 'user_id', $user->ID )
			: false;
		$customer_id = $customer ? absint( $customer->id ) : null;
		$email_mismatch = $customer && strtolower( trim( (string) $customer->email ) ) !== strtolower( trim( (string) $user->user_email ) );

		return CH_API::success(
			array(
				'user'                       => self::safe_profile( $user ),
				'edd_customer_id'            => $customer_id,
				'identity_email_mismatch'    => (bool) $email_mismatch,
			)
		);
	}

	/** Set no-store on successes and errors for all private auth responses. */
	public function disable_auth_response_caching( $response, $server, $request ) {
		$route = $request->get_route();
		if ( 0 === strpos( $route, '/' . CH_API::NAMESPACE . '/auth/' ) || 0 === strpos( $route, '/' . CH_API::NAMESPACE . '/customer/claim/' ) || 0 === strpos( $route, '/' . CH_API::NAMESPACE . '/customer/' ) || '/' . CH_API::NAMESPACE . '/cart/validate' === $route || 0 === strpos( $route, '/' . CH_API::NAMESPACE . '/checkout/' ) ) {
			$response = rest_ensure_response( $response );
			$response->header( 'Cache-Control', 'private, no-store, no-cache, max-age=0, must-revalidate' );
			$response->header( 'Pragma', 'no-cache' );
		}

		return $response;
	}

	private static function safe_profile( $user ) {
		return array(
			'id'         => (int) $user->ID,
			'email'      => (string) $user->user_email,
			'first_name' => (string) get_user_meta( $user->ID, 'first_name', true ),
			'last_name'  => (string) get_user_meta( $user->ID, 'last_name', true ),
			'created_at' => (string) $user->user_registered,
		);
	}

	private static function invalid_credentials() {
		return CH_API::error( 'invalid_credentials', 'The email or password is incorrect.', 401 );
	}

	private static function bridge_secret() {
		if ( defined( 'CH_LOCAL_AUTH_BRIDGE_SECRET' ) ) {
			$secret = constant( 'CH_LOCAL_AUTH_BRIDGE_SECRET' );
		} else {
			$secret = getenv( 'CH_AUTH_BRIDGE_SECRET' );
		}
		return is_string( $secret ) ? $secret : '';
	}

	private static function is_secure_transport() {
		return 'production' !== wp_get_environment_type() || is_ssl();
	}

	private static function rate_limit_keys( $ip, $email ) {
		$salt = wp_salt( 'auth' );
		return array(
			'ip'    => 'ch_auth_ip_' . hash_hmac( 'sha256', $ip, $salt ),
			'login' => 'ch_auth_login_' . hash_hmac( 'sha256', $ip . '|' . $email, $salt ),
		);
	}

	private static function is_rate_limited( $keys ) {
		foreach ( $keys as $key ) {
			if ( (int) get_transient( $key ) >= self::MAX_LOGIN_ATTEMPTS ) {
				return true;
			}
		}

		return false;
	}

	private static function record_failed_attempt( $keys ) {
		foreach ( $keys as $key ) {
			$count = (int) get_transient( $key );
			set_transient( $key, $count + 1, self::LOGIN_WINDOW );
		}
	}

	private static function clear_login_rate_limit( $keys ) {
		delete_transient( $keys['login'] );
		$ip_attempts = max( 0, (int) get_transient( $keys['ip'] ) - 1 );
		if ( 0 === $ip_attempts ) {
			delete_transient( $keys['ip'] );
		} else {
			set_transient( $keys['ip'], $ip_attempts, self::LOGIN_WINDOW );
		}
	}

	/** Validate account passwords at the backend boundary. */
	public static function is_strong_password( $password ) {
		if ( ! is_string( $password ) || strlen( $password ) < 12 || strlen( $password ) > 128 ) {
			return false;
		}
		$classes = 0;
		$classes += preg_match( '/[a-z]/', $password ) ? 1 : 0;
		$classes += preg_match( '/[A-Z]/', $password ) ? 1 : 0;
		$classes += preg_match( '/[0-9]/', $password ) ? 1 : 0;
		$classes += preg_match( '/[^A-Za-z0-9]/', $password ) ? 1 : 0;
		return $classes >= 3;
	}

	private function allow_email_action( $purpose, $ip, $email ) {
		$ip_key    = self::limit_key( $purpose . '_ip', $ip );
		$email_key = self::limit_key( $purpose . '_email', strtolower( (string) $email ) );
		$ip_ok     = $this->take_action_limit( $ip_key, self::ACTION_LIMIT_IP, HOUR_IN_SECONDS );
		$email_ok  = $this->take_action_limit( $email_key, self::ACTION_LIMIT_EMAIL, HOUR_IN_SECONDS );
		return $ip_ok && $email_ok;
	}

	private function allow_ip_action( $purpose, $ip ) {
		return $this->take_action_limit( self::limit_key( $purpose . '_ip', $ip ), self::ACTION_LIMIT_IP, HOUR_IN_SECONDS );
	}

	private function take_action_limit( $key, $limit, $ttl ) {
		global $wpdb;
		$lock_name = 'ch_auth_rl_' . substr( hash( 'sha256', $key ), 0, 40 );
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

	private function send_capability_email( $user, $purpose, $frontend ) {
		if ( ! $frontend || ! $user || empty( $user->ID ) || empty( $user->user_email ) ) {
			return false;
		}
		try {
			$token = bin2hex( random_bytes( 32 ) );
		} catch ( Throwable $error ) {
			return false;
		}

		$ttl        = 'verify' === $purpose ? self::VERIFICATION_TTL : self::RESET_TTL;
		$transient  = self::capability_transient_key( $purpose, hash( 'sha256', $token ) );
		$normalized = strtolower( trim( (string) $user->user_email ) );
		$stored = set_transient(
			$transient,
			array(
				'user_id'    => (int) $user->ID,
				'email_hash' => hash( 'sha256', $normalized ),
				'expires_at' => time() + $ttl,
			),
			$ttl
		);
		if ( ! $stored ) {
			return false;
		}

		if ( 'verify' === $purpose ) {
			$url     = $frontend . '/verify-email#' . $token;
			$subject = 'Verify your Creative Hatti email';
			$message = "Please verify your email address to activate your Creative Hatti account.\n\n";
			$message .= 'Open this link within 30 minutes: ' . $url . "\n\n";
			$message .= 'If you did not create this account, you can ignore this email.';
		} else {
			$url     = $frontend . '/reset-password#' . $token;
			$subject = 'Reset your Creative Hatti password';
			$message = "A password reset was requested for your Creative Hatti account.\n\n";
			$message .= 'Choose a new password within 24 hours: ' . $url . "\n\n";
			$message .= 'If you did not request this, you can ignore this email. Your password has not changed.';
		}

		if ( ! wp_mail( (string) $user->user_email, $subject, $message ) ) {
			delete_transient( $transient );
			return false;
		}
		return true;
	}

	private function lock_capability( $purpose, $token ) {
		if ( ! is_string( $token ) || ! preg_match( '/^[a-f0-9]{64}$/D', $token ) ) {
			return false;
		}
		$hash      = hash( 'sha256', $token );
		$lock_name = 'ch_auth_token_' . substr( hash( 'sha256', $purpose . '|' . $hash ), 0, 40 );
		global $wpdb;
		if ( 1 !== (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 3)', $lock_name ) ) ) {
			return false;
		}
		return array(
			'lock'      => $lock_name,
			'transient' => self::capability_transient_key( $purpose, $hash ),
		);
	}

	private function release_capability_lock( $lock ) {
		global $wpdb;
		$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock['lock'] ) );
	}

	private function valid_capability_record( $record, $user ) {
		return is_array( $record ) && $user && ! empty( $record['user_id'] ) && (int) $record['user_id'] === (int) $user->ID && ! empty( $record['email_hash'] ) && ! empty( $record['expires_at'] ) && (int) $record['expires_at'] >= time() && hash_equals( (string) $record['email_hash'], hash( 'sha256', strtolower( trim( (string) $user->user_email ) ) ) );
	}

	private static function capability_transient_key( $purpose, $token_hash ) {
		return 'ch_auth_' . sanitize_key( $purpose ) . '_' . $token_hash;
	}

	private static function validated_frontend_url( $origin ) {
		$url = $origin;
		$url = is_string( $url ) ? rtrim( trim( $url ), '/' ) : '';
		$parts = $url ? wp_parse_url( $url ) : false;
		if ( ! is_array( $parts ) || empty( $parts['host'] ) || ! in_array( $parts['scheme'] ?? '', array( 'http', 'https' ), true ) || isset( $parts['user'] ) || isset( $parts['pass'] ) || isset( $parts['query'] ) || isset( $parts['fragment'] ) || ! in_array( $parts['path'] ?? '', array( '', '/' ), true ) || ( 'production' === wp_get_environment_type() && 'https' !== $parts['scheme'] ) ) {
			return '';
		}
		return $url;
	}

	private static function limit_key( $purpose, $value ) {
		return 'ch_auth_' . sanitize_key( $purpose ) . '_' . hash_hmac( 'sha256', (string) $value, wp_salt( 'auth' ) );
	}

	private static function registration_accepted() {
		return CH_API::success( array( 'message' => 'If an account can be registered, verification instructions are on the way.' ), 202 );
	}

	private static function reset_accepted() {
		return CH_API::success( array( 'message' => 'If an account exists with that email, password reset instructions are on the way.' ), 202 );
	}

	private static function rate_limited() {
		$response = CH_API::error( 'rate_limited', 'Too many attempts. Please try again later.', 429 );
		$response->header( 'Retry-After', (string) HOUR_IN_SECONDS );
		return $response;
	}

	private static function invalid_capability( $purpose ) {
		if ( 'password_reset' === $purpose ) {
			return CH_API::error( 'expired_token', 'This password reset link is invalid or has expired. Request a fresh link.', 400 );
		}
		return CH_API::error( 'invalid_verification', 'This verification link is invalid or has expired. Request a fresh link.', 400 );
	}
}
