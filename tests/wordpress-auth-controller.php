<?php
/** Isolated tests for the Creative Hatti WordPress auth controller. */

define( 'ABSPATH', __DIR__ );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'DAY_IN_SECONDS', 86400 );
define( 'MINUTE_IN_SECONDS', 60 );

final class WP_Error {
	public $code;
	public $message;
	public $data;
	public function __construct( $code, $message, $data = array() ) { $this->code = $code; $this->message = $message; $this->data = $data; }
}

final class WP_User {
	public $ID;
	public $user_login;
	public $user_email;
	public $user_registered;
	public function __construct( $id, $login, $email ) { $this->ID = $id; $this->user_login = $login; $this->user_email = $email; $this->user_registered = '2024-01-02 03:04:05'; }
}

final class WP_REST_Server {
	const CREATABLE = 'POST';
	const READABLE = 'GET';
}

final class WP_REST_Response {
	public $data;
	public $status;
	public $headers = array();
	public function __construct( $data, $status = 200 ) { $this->data = $data; $this->status = $status; }
	public function header( $name, $value ) { $this->headers[ $name ] = $value; }
}

final class FakeRequest {
	private $headers;
	private $params;
	private $route;
	public function __construct( $params = array(), $headers = array(), $route = '/ch/v1/customer/me' ) { $this->params = $params; $this->headers = array_change_key_case( $headers, CASE_LOWER ); $this->route = $route; }
	public function get_header( $name ) { return $this->headers[ strtolower( $name ) ] ?? ''; }
	public function get_param( $name ) { return $this->params[ $name ] ?? null; }
	public function set_param( $name, $value ) { $this->params[ $name ] = $value; }
	public function get_route() { return $this->route; }
}

final class FakeWpdb {
	public $users = 'wp_users';
	public $email_count = 1;
	public function prepare( $query, $value ) { return $query; }
	public function get_var() { return $this->email_count; }
}

final class WP_Session_Tokens {
	private static $sessions = array();
	private $user_id;
	public static function get_instance( $user_id ) { return new self( $user_id ); }
	private function __construct( $user_id ) { $this->user_id = $user_id; }
	public function create( $expiration ) {
		$token = str_repeat( 'A', 43 );
		self::$sessions[ $this->user_id ][ $token ] = $expiration;
		return $token;
	}
	public function verify( $token ) {
		foreach ( self::$sessions[ $this->user_id ] ?? array() as $stored => $expiration ) {
			if ( hash_equals( $stored, $token ) && $expiration >= time() ) return true;
		}
		return false;
	}
	public function destroy( $token ) { unset( self::$sessions[ $this->user_id ][ $token ] ); }
	public static function expire( $user_id, $token ) { self::$sessions[ $user_id ][ $token ] = time() - 1; }
}

final class CH_API {
	const NAMESPACE = 'ch/v1';
	public static function success( $data, $status = 200 ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data ), $status ); }
	public static function error( $code, $message, $status ) { return new WP_REST_Response( array( 'success' => false, 'error' => array( 'code' => $code, 'message' => $message ) ), $status ); }
}

class FakeWpdbGlobal {}
$GLOBALS['wpdb'] = new FakeWpdb();
$GLOBALS['users_by_email'] = array();
$GLOBALS['users_by_id'] = array();
$GLOBALS['current_user_id'] = 0;
$GLOBALS['native_auth_calls'] = 0;
$GLOBALS['environment_type'] = 'local';
$GLOBALS['ssl'] = true;
$GLOBALS['edd_customer'] = false;
$GLOBALS['transients'] = array();

function add_filter( ...$args ) {}
function register_rest_route( ...$args ) { $GLOBALS['routes'][] = $args[1]; }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function sanitize_email( $email ) { return filter_var( $email, FILTER_VALIDATE_EMAIL ) ? $email : ''; }
function absint( $value ) { return abs( (int) $value ); }
function get_user_by( $field, $value ) {
	if ( 'email' === $field ) return $GLOBALS['users_by_email'][ strtolower( $value ) ] ?? false;
	return $GLOBALS['users_by_id'][ (int) $value ] ?? false;
}
function wp_authenticate( $login, $password ) {
	++$GLOBALS['native_auth_calls'];
	foreach ( $GLOBALS['users_by_email'] as $user ) {
		if ( $user->user_login === $login && hash_equals( 'correct-password', $password ) ) return $user;
	}
	return new WP_Error( 'incorrect_password', 'Private core error text.' );
}
function wp_set_current_user( $user_id ) { $GLOBALS['current_user_id'] = (int) $user_id; }
function get_current_user_id() { return $GLOBALS['current_user_id']; }
function wp_get_current_user() { return get_user_by( 'id', get_current_user_id() ); }
function get_user_meta( $user_id, $key, $single ) { return 'first_name' === $key ? 'Test' : 'Account'; }
function edd_get_customer_by( $field, $user_id ) { return $GLOBALS['edd_customer']; }
function get_transient( $key ) { return $GLOBALS['transients'][ $key ] ?? false; }
function set_transient( $key, $value, $expiration ) { $GLOBALS['transients'][ $key ] = $value; }
function delete_transient( $key ) { unset( $GLOBALS['transients'][ $key ] ); }
function wp_salt( $scheme ) { return 'test-only-secret-salt'; }
function wp_get_environment_type() { return $GLOBALS['environment_type']; }
function is_ssl() { return $GLOBALS['ssl']; }
function rest_ensure_response( $response ) { return $response instanceof WP_REST_Response ? $response : new WP_REST_Response( $response ); }

require_once __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-auth-controller.php';

function expect( $condition, $message ) {
	if ( ! $condition ) { fwrite( STDERR, "FAIL: {$message}\n" ); exit( 1 ); }
	++$GLOBALS['assertions'];
}

function expect_status( $response, $status, $message ) {
	expect( $response instanceof WP_REST_Response && $response->status === $status, $message );
}

$GLOBALS['assertions'] = 0;
putenv( 'CH_AUTH_BRIDGE_SECRET=' . str_repeat( 's', 48 ) );
$user = new WP_User( 71, 'legacy-login', 'user@example.test' );
$GLOBALS['users_by_email'][ $user->user_email ] = $user;
$GLOBALS['users_by_id'][ $user->ID ] = $user;
$GLOBALS['_SERVER']['REMOTE_ADDR'] = '192.0.2.7';
$controller = new CH_Auth_Controller();
$bridge = array( 'X-CH-Auth-Bridge' => str_repeat( 's', 48 ) );

$controller->register_routes();
expect( in_array( '/auth/login', $GLOBALS['routes'], true ), 'registers login route' );
expect( in_array( '/auth/logout', $GLOBALS['routes'], true ), 'registers logout route' );
expect( in_array( '/customer/me', $GLOBALS['routes'], true ), 'registers current customer route' );
expect( true === $controller->bridge_permission( new FakeRequest( array(), $bridge ) ), 'accepts the configured server bridge secret' );
expect( is_wp_error( $controller->bridge_permission( new FakeRequest( array(), array( 'X-CH-Auth-Bridge' => 'wrong' ) ) ) ), 'rejects an invalid bridge secret' );
$GLOBALS['environment_type'] = 'production';
$GLOBALS['ssl'] = false;
$https_error = $controller->bridge_permission( new FakeRequest( array(), $bridge ) );
expect( is_wp_error( $https_error ) && 403 === $https_error->data['status'], 'production authentication rejects non-HTTPS requests' );
$GLOBALS['environment_type'] = 'local';
$GLOBALS['ssl'] = true;

$login = $controller->login( new FakeRequest( array( 'email' => 'USER@example.test', 'password' => 'correct-password' ) ) );
expect_status( $login, 200, 'successful native WordPress authentication creates a session' );
expect( $GLOBALS['native_auth_calls'] > 0, 'credentials are verified through WordPress native authentication' );
$no_cache = $controller->disable_auth_response_caching( new WP_REST_Response( array() ), null, new FakeRequest( array(), array(), '/ch/v1/customer/me' ) );
expect( 'private, no-store, no-cache, max-age=0, must-revalidate' === $no_cache->headers['Cache-Control'], 'customer identity response disables caches' );
$orders_no_cache = $controller->disable_auth_response_caching( new WP_REST_Response( array() ), null, new FakeRequest( array(), array(), '/ch/v1/customer/orders/123' ) );
expect( 'private, no-store, no-cache, max-age=0, must-revalidate' === $orders_no_cache->headers['Cache-Control'], 'customer order responses disable caches' );
$downloads_no_cache = $controller->disable_auth_response_caching( new WP_REST_Response( array() ), null, new FakeRequest( array(), array(), '/ch/v1/customer/downloads' ) );
expect( 'private, no-store, no-cache, max-age=0, must-revalidate' === $downloads_no_cache->headers['Cache-Control'], 'customer download responses disable caches' );
$profile_no_cache = $controller->disable_auth_response_caching( new WP_REST_Response( array() ), null, new FakeRequest( array(), array(), '/ch/v1/customer/profile' ) );
expect( 'private, no-store, no-cache, max-age=0, must-revalidate' === $profile_no_cache->headers['Cache-Control'], 'customer profile responses disable caches' );
$licenses_no_cache = $controller->disable_auth_response_caching( new WP_REST_Response( array() ), null, new FakeRequest( array(), array(), '/ch/v1/customer/licenses' ) );
expect( 'private, no-store, no-cache, max-age=0, must-revalidate' === $licenses_no_cache->headers['Cache-Control'], 'customer license responses disable caches' );
$session = $login->data['data']['session'];
$auth_header = 'Bearer ' . $session['user_id'] . '.' . $session['token'];

$bad = $controller->login( new FakeRequest( array( 'email' => 'USER@example.test', 'password' => 'wrong-password' ) ) );
expect_status( $bad, 401, 'invalid password is rejected' );
expect( 'The email or password is incorrect.' === $bad->data['error']['message'], 'invalid credentials use a generic response' );
$GLOBALS['wpdb']->email_count = 0;
$unknown = $controller->login( new FakeRequest( array( 'email' => 'unknown@example.test', 'password' => 'wrong-password' ) ) );
expect( $unknown->status === $bad->status && $unknown->data['error']['message'] === $bad->data['error']['message'], 'unknown email does not reveal account existence' );
$GLOBALS['wpdb']->email_count = 1;

$no_customer_request = new FakeRequest( array(), $bridge + array( 'Authorization' => $auth_header ) );
expect( true === $controller->session_permission( $no_customer_request ), 'valid session is checked against WordPress session storage' );
$no_customer = $controller->current_customer();
expect( null === $no_customer->data['data']['edd_customer_id'], 'authenticated user without EDD customer remains valid' );
expect( false === $no_customer->data['data']['identity_email_mismatch'], 'missing customer does not report an email mismatch' );
expect( ! isset( $no_customer->data['data']['edd_email'] ), 'identity response never exposes a customer email' );

$GLOBALS['edd_customer'] = (object) array( 'id' => 904, 'email' => 'different@example.test' );
$mismatch = $controller->current_customer();
expect( 904 === $mismatch->data['data']['edd_customer_id'], 'resolves only the customer linked by user_id' );
expect( true === $mismatch->data['data']['identity_email_mismatch'], 'flags differing linked emails' );
expect( ! isset( $mismatch->data['data']['edd_email'] ), 'mismatch flag does not expose the EDD email' );

$logout_request = new FakeRequest( array(), $bridge + array( 'Authorization' => $auth_header ) );
expect( true === $controller->session_permission( $logout_request ), 'session remains valid before logout' );
$logout = $controller->logout( $logout_request );
expect_status( $logout, 200, 'logout endpoint succeeds' );
$revoked = $controller->session_permission( new FakeRequest( array(), $bridge + array( 'Authorization' => $auth_header ) ) );
expect( is_wp_error( $revoked ) && 401 === $revoked->data['status'], 'logout revokes the WordPress session token' );

$limited = null;
for ( $i = 0; $i < 8; ++$i ) {
	$limited = $controller->login( new FakeRequest( array( 'email' => 'USER@example.test', 'password' => 'wrong-password' ) ) );
}
expect_status( $controller->login( new FakeRequest( array( 'email' => 'USER@example.test', 'password' => 'correct-password' ) ) ), 429, 'login attempts are rate limited by IP and submitted identity' );

WP_Session_Tokens::get_instance( $session['user_id'] )->create( time() + 3600 );
WP_Session_Tokens::expire( $session['user_id'], $session['token'] );
$expired_request = new FakeRequest( array(), $bridge + array( 'Authorization' => $auth_header ) );
$expired = $controller->session_permission( $expired_request );
expect( is_wp_error( $expired ) && 401 === $expired->data['status'], 'expired session is rejected' );

echo 'PASS: ' . $GLOBALS['assertions'] . " WordPress auth controller assertions\n";
