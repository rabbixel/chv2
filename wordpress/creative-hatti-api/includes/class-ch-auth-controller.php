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

	public function __construct() {
		add_filter( 'rest_post_dispatch', array( $this, 'disable_auth_response_caching' ), 10, 3 );
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

		if ( ! $authenticated || is_wp_error( $authenticated ) || ! ( $authenticated instanceof WP_User ) ) {
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
		$secret = getenv( 'CH_AUTH_BRIDGE_SECRET' );
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
}
