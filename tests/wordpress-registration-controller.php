<?php
/** Synthetic-only tests for registration, verification and password recovery. */

define( 'ABSPATH', __DIR__ );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'DAY_IN_SECONDS', 86400 );

final class WP_Error {
	public $code; public $message; public $data;
	public function __construct( $code, $message = '', $data = array() ) { $this->code = $code; $this->message = $message; $this->data = $data; }
}
final class WP_User {
	public $ID; public $user_login; public $user_email; public $user_registered = '2026-01-01 00:00:00';
	public function __construct( $id, $login, $email ) { $this->ID = $id; $this->user_login = $login; $this->user_email = $email; }
}
final class WP_REST_Server { const CREATABLE = 'POST'; const READABLE = 'GET'; }
final class WP_REST_Response {
	public $data; public $status; public $headers = array();
	public function __construct( $data, $status = 200 ) { $this->data = $data; $this->status = $status; }
	public function header( $name, $value ) { $this->headers[ $name ] = $value; }
}
final class FakeRequest {
	private $params; private $headers; private $route;
	public function __construct( $params = array(), $headers = array(), $route = '/ch/v1/auth/register' ) { $this->params = $params; $this->headers = array_change_key_case( $headers, CASE_LOWER ); $this->route = $route; }
	public function get_param( $key ) { return $this->params[ $key ] ?? null; }
	public function get_header( $key ) { return $this->headers[ strtolower( $key ) ] ?? ''; }
	public function set_param( $key, $value ) { $this->params[ $key ] = $value; }
	public function get_route() { return $this->route; }
}
final class WP_Session_Tokens {
	private $user_id; private static $sequence = 0;
	public static function get_instance( $user_id ) { return new self( $user_id ); }
	private function __construct( $user_id ) { $this->user_id = (int) $user_id; }
	public function create( $expiration ) { $token = strtoupper( str_pad( base_convert( (string) ++self::$sequence, 10, 36 ), 43, 'A' ) ); $GLOBALS['sessions'][ $this->user_id ][ $token ] = $expiration; return $token; }
	public function verify( $token ) { return isset( $GLOBALS['sessions'][ $this->user_id ][ $token ] ) && $GLOBALS['sessions'][ $this->user_id ][ $token ] >= time(); }
	public function destroy( $token ) { unset( $GLOBALS['sessions'][ $this->user_id ][ $token ] ); }
	public function destroy_all() { $GLOBALS['sessions'][ $this->user_id ] = array(); }
}
final class FakeWpdb {
	public $users = 'wp_users';
	public function prepare( $query, ...$args ) {
		foreach ( $args as $value ) {
			$replacement = is_int( $value ) ? (string) $value : "'" . addslashes( (string) $value ) . "'";
			$query = preg_replace( '/%[sd]/', $replacement, $query, 1 );
		}
		return $query;
	}
	public function get_var( $query ) {
		if ( false !== strpos( $query, 'GET_LOCK' ) || false !== strpos( $query, 'RELEASE_LOCK' ) ) return 1;
		if ( preg_match( "/(?:LOWER\(user_email\)|user_email) = '([^']*)'/", $query, $match ) ) {
			$count = 0;
			foreach ( $GLOBALS['users_by_email'] as $email => $user ) if ( strtolower( $email ) === strtolower( stripslashes( $match[1] ) ) ) ++$count;
			return $count;
		}
		return null;
	}
}

$GLOBALS['wpdb'] = new FakeWpdb();
$GLOBALS['routes'] = array();
$GLOBALS['users_by_id'] = array();
$GLOBALS['users_by_email'] = array();
$GLOBALS['user_meta'] = array();
$GLOBALS['passwords'] = array();
$GLOBALS['sessions'] = array();
$GLOBALS['transients'] = array();
$GLOBALS['sent_mail'] = array();
$GLOBALS['current_user_id'] = 0;
$GLOBALS['filters'] = array();
$GLOBALS['assertions'] = 0;
$GLOBALS['environment_type'] = 'local';
$_SERVER['REMOTE_ADDR'] = '198.51.100.70';
putenv( 'CH_AUTH_BRIDGE_SECRET=' . str_repeat( 'e', 48 ) );
define( 'CH_LOCAL_AUTH_BRIDGE_SECRET', str_repeat( 'b', 48 ) );
putenv( 'CH_AUTH_FRONTEND_URL=http://localhost:3000' );

function add_filter( $hook, $callback, $priority = 10, $accepted_args = 1 ) { $GLOBALS['filters'][ $hook ] = $callback; }
function register_rest_route( $namespace, $route, $args ) { $GLOBALS['routes'][ $route ] = $args; }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function sanitize_email( $email ) { return filter_var( $email, FILTER_VALIDATE_EMAIL ) ? $email : ''; }
function is_email( $email ) { return false !== filter_var( $email, FILTER_VALIDATE_EMAIL ); }
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_key( $value ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) ); }
function sanitize_user( $value, $strict = false ) { return preg_replace( '/[^a-z0-9_.-]/i', '', strtolower( (string) $value ) ); }
function absint( $value ) { return abs( (int) $value ); }
function username_exists( $login ) { foreach ( $GLOBALS['users_by_id'] as $user ) if ( $user->user_login === $login ) return true; return false; }
function wp_generate_password( $length = 12, $special = true, $extra = false ) { return str_repeat( 'Z', $length ); }
function get_user_by( $field, $value ) { return 'id' === $field ? ( $GLOBALS['users_by_id'][ (int) $value ] ?? false ) : ( $GLOBALS['users_by_email'][ strtolower( (string) $value ) ] ?? false ); }
function get_user_meta( $user_id, $key, $single = true ) { return $GLOBALS['user_meta'][ (int) $user_id ][ $key ] ?? ''; }
function update_user_meta( $user_id, $key, $value ) { $GLOBALS['user_meta'][ (int) $user_id ][ $key ] = $value; return true; }
function wp_insert_user( $data ) {
	if ( get_user_by( 'email', $data['user_email'] ) ) return new WP_Error( 'existing_user' );
	$id = empty( $GLOBALS['users_by_id'] ) ? 1000 : max( array_keys( $GLOBALS['users_by_id'] ) ) + 1;
	$user = new WP_User( $id, $data['user_login'], $data['user_email'] );
	$GLOBALS['users_by_id'][ $id ] = $user;
	$GLOBALS['users_by_email'][ strtolower( $data['user_email'] ) ] = $user;
	$GLOBALS['passwords'][ strtolower( $data['user_email'] ) ] = $data['user_pass'];
	return $id;
}
function wp_set_password( $password, $user_id ) { $user = get_user_by( 'id', $user_id ); $GLOBALS['passwords'][ strtolower( $user->user_email ) ] = $password; }
function wp_authenticate( $login, $password ) {
	foreach ( $GLOBALS['users_by_id'] as $user ) if ( $user->user_login === $login && hash_equals( $GLOBALS['passwords'][ strtolower( $user->user_email ) ], $password ) ) return $GLOBALS['filters']['wp_authenticate_user']( $user, $password );
	return new WP_Error( 'invalid_credentials', 'Private authentication detail.' );
}
function wp_set_current_user( $user_id ) { $GLOBALS['current_user_id'] = (int) $user_id; }
function get_current_user_id() { return $GLOBALS['current_user_id']; }
function wp_get_current_user() { return get_user_by( 'id', get_current_user_id() ); }
function get_transient( $key ) { $record = $GLOBALS['transients'][ $key ] ?? false; if ( is_array( $record ) && isset( $record['_expires'] ) && $record['_expires'] < time() ) { unset( $GLOBALS['transients'][ $key ] ); return false; } return is_array( $record ) && array_key_exists( '_value', $record ) ? $record['_value'] : $record; }
function set_transient( $key, $value, $ttl ) { $GLOBALS['transients'][ $key ] = array( '_value' => $value, '_expires' => time() + $ttl ); return true; }
function delete_transient( $key ) { unset( $GLOBALS['transients'][ $key ] ); return true; }
function wp_salt( $scheme = '' ) { return 'test-only-bridge-salt'; }
function wp_get_environment_type() { return $GLOBALS['environment_type']; }
function is_ssl() { return true; }
function wp_parse_url( $url ) { return parse_url( $url ); }
function wp_mail( $to, $subject, $message ) { $GLOBALS['sent_mail'][] = array( 'to' => $to, 'subject' => $subject, 'message' => $message ); return true; }
function rest_ensure_response( $response ) { return $response instanceof WP_REST_Response ? $response : new WP_REST_Response( $response ); }

final class CH_API {
	const NAMESPACE = 'ch/v1';
	public static function success( $data, $status = 200 ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data ), $status ); }
	public static function error( $code, $message, $status ) { return new WP_REST_Response( array( 'success' => false, 'error' => array( 'code' => $code, 'message' => $message ), 'status' => $status ), $status ); }
}

require_once __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-auth-controller.php';

function check( $condition, $message ) { if ( ! $condition ) { fwrite( STDERR, "FAIL: {$message}\n" ); exit( 1 ); } ++$GLOBALS['assertions']; }
function mail_token( $index = -1 ) { if ( $index < 0 ) $index = count( $GLOBALS['sent_mail'] ) - 1; preg_match( '~#([a-f0-9]{64})~', $GLOBALS['sent_mail'][ $index ]['message'] ?? '', $match ); return $match[1] ?? ''; }
function request( $controller, $method, $params = array(), $headers = array() ) {
	if ( in_array( $method, array( 'register_account', 'resend_activation', 'forgot_password' ), true ) && ! isset( $params['frontend_origin'] ) ) $params['frontend_origin'] = 'http://localhost:3000';
	return $controller->$method( new FakeRequest( $params, $headers ) );
}

$controller = new CH_Auth_Controller();
$controller->register_routes();
$bridge = array( 'X-CH-Auth-Bridge' => str_repeat( 'b', 48 ) );
foreach ( array( '/auth/register', '/auth/verify-email', '/auth/resend-activation', '/auth/forgot-password', '/auth/reset-password' ) as $route ) {
	check( isset( $GLOBALS['routes'][ $route ] ), 'registers ' . $route );
	check( true === $GLOBALS['routes'][ $route ]['permission_callback']( new FakeRequest( array(), $bridge ) ), 'protects ' . $route . ' with trusted bridge' );
	check( is_wp_error( $GLOBALS['routes'][ $route ]['permission_callback']( new FakeRequest() ) ), 'rejects untrusted bridge for ' . $route );
}
check( CH_Auth_Controller::is_strong_password( 'SyntheticPassword!234' ) && CH_Auth_Controller::is_strong_password( 'TwelveChars1A' ) && ! CH_Auth_Controller::is_strong_password( 'onlylowercase123' ) && ! CH_Auth_Controller::is_strong_password( 'A1!' . str_repeat( 'a', 126 ) ), 'enforces 12-128 bytes and at least three of four character types' );

$weak = request( $controller, 'register_account', array( 'name' => 'Test User', 'email' => 'new@example.invalid', 'password' => 'weakpassword' ) );
check( 400 === $weak->status && 'weak_password' === $weak->data['error']['code'], 'rejects a weak registration password with a field-specific code' );
check( false !== strpos( $weak->data['error']['message'], '12 characters' ) && false !== strpos( $weak->data['error']['message'], '3 of the 4' ), 'explains the actual backend password requirements' );
$invalid_email = request( $controller, 'register_account', array( 'name' => 'Test User', 'email' => 'bad-address', 'password' => 'SyntheticPassword!234' ) );
check( 400 === $invalid_email->status && 'invalid_email' === $invalid_email->data['error']['code'], 'returns a field-specific email validation error' );
$invalid_name = request( $controller, 'register_account', array( 'name' => 'A', 'email' => 'valid-name@example.invalid', 'password' => 'SyntheticPassword!234' ) );
check( 400 === $invalid_name->status && 'invalid_name' === $invalid_name->data['error']['code'], 'returns a field-specific name validation error' );
$invalid_origin = request( $controller, 'register_account', array( 'name' => 'Synthetic User', 'email' => 'bad-origin@example.invalid', 'password' => 'SyntheticPassword!234', 'frontend_origin' => 'https://user@attacker.invalid' ) );
check( 202 === $invalid_origin->status && ! get_user_by( 'email', 'bad-origin@example.invalid' ) && 0 === count( $GLOBALS['sent_mail'] ), 'rejects a malformed verification-link origin without creating an account or sending email' );
$registered = request( $controller, 'register_account', array( 'name' => 'Synthetic User', 'email' => 'new@example.invalid', 'password' => 'SyntheticPassword!234' ) );
check( 202 === $registered->status && 1 === count( $GLOBALS['sent_mail'] ), 'creates pending synthetic account and sends verification email' );
$user = get_user_by( 'email', 'new@example.invalid' );
check( $user && '0' === get_user_meta( $user->ID, '_ch_email_verified', true ), 'new account remains unverified until email capability is used' );
$first_token = mail_token();
check( 64 === strlen( $first_token ) && false === strpos( serialize( $GLOBALS['transients'] ), $first_token ), 'stores only a hash of the verification token' );
$login_pending = request( $controller, 'login', array( 'email' => 'new@example.invalid', 'password' => 'SyntheticPassword!234' ) );
check( 401 === $login_pending->status && 'invalid_credentials' === $login_pending->data['error']['code'], 'pending account login fails without exposing activation state' );
$pending_core_auth = $controller->reject_unverified_user( $user, 'SyntheticPassword!234' );
check( is_wp_error( $pending_core_auth ), 'pending account is also rejected by WordPress password authentication filter' );
$pending_session = WP_Session_Tokens::get_instance( $user->ID )->create( time() + HOUR_IN_SECONDS );
$pending_permission = $controller->session_permission( new FakeRequest( array(), $bridge + array( 'Authorization' => 'Bearer ' . $user->ID . '.' . $pending_session ) ) );
check( is_wp_error( $pending_permission ) && 403 === ( $pending_permission->data['status'] ?? null ), 'pending account cannot use protected session endpoints (status ' . ( $pending_permission->data['status'] ?? 'none' ) . ')' );

$duplicate = request( $controller, 'register_account', array( 'name' => 'Synthetic User', 'email' => 'new@example.invalid', 'password' => 'SyntheticPassword!234' ) );
check( 202 === $duplicate->status && $duplicate->data['data']['message'] === $registered->data['data']['message'], 'duplicate registration returns the same public response' );
$verify_key = 'ch_auth_verify_' . hash( 'sha256', $first_token );
$expired_record = get_transient( $verify_key );
$expired_record['expires_at'] = time() - 1;
set_transient( $verify_key, $expired_record, HOUR_IN_SECONDS );
$expired_verify = request( $controller, 'verify_email', array( 'token' => $first_token ), $bridge );
check( 400 === $expired_verify->status && '0' === get_user_meta( $user->ID, '_ch_email_verified', true ), 'expired verification token is rejected without activating account' );

$resent = request( $controller, 'resend_activation', array( 'email' => 'new@example.invalid' ) );
check( 202 === $resent->status && count( $GLOBALS['sent_mail'] ) >= 3, 'resend endpoint sends only a fresh pending-account link with generic response' );
$verification_token = mail_token();
$verified = request( $controller, 'verify_email', array( 'token' => $verification_token ), $bridge );
check( 200 === $verified->status && '1' === get_user_meta( $user->ID, '_ch_email_verified', true ), 'valid verification activates account' );
check( $verified->data['data']['session']['user_id'] === $user->ID && strlen( $verified->data['data']['session']['token'] ) === 43, 'successful verification establishes a WordPress session' );
$replay = request( $controller, 'verify_email', array( 'token' => $verification_token ), $bridge );
check( 400 === $replay->status, 'verification capability cannot be replayed' );
$direct_auth = wp_authenticate( $user->user_login, 'SyntheticPassword!234' );
check( $direct_auth instanceof WP_User, 'verified synthetic user passes native password authentication (type ' . gettype( $direct_auth ) . ')' );
$login = request( $controller, 'login', array( 'email' => 'new@example.invalid', 'password' => 'SyntheticPassword!234' ) );
check( 200 === $login->status, 'verified synthetic account can log in (status ' . $login->status . ', code ' . ( $login->data['error']['code'] ?? 'none' ) . ')' );

$forgot_unknown = request( $controller, 'forgot_password', array( 'email' => 'unknown@example.invalid' ) );
$mail_before_known = count( $GLOBALS['sent_mail'] );
$forgot_known = request( $controller, 'forgot_password', array( 'email' => 'new@example.invalid' ) );
check( 202 === $forgot_known->status && $forgot_known->data['data']['message'] === $forgot_unknown->data['data']['message'], 'known and unknown reset addresses receive identical responses' );
check( count( $GLOBALS['sent_mail'] ) === $mail_before_known + 1, 'reset email is sent only for an existing account' );
$reset_token = mail_token();
$reset_key = 'ch_auth_reset_' . hash( 'sha256', $reset_token );
$reset_record = get_transient( $reset_key );
$reset_record['expires_at'] = time() - 1;
set_transient( $reset_key, $reset_record, HOUR_IN_SECONDS );
$expired_reset = request( $controller, 'reset_password', array( 'token' => $reset_token, 'password' => 'RenewedPassword!456' ), $bridge );
check( 400 === $expired_reset->status && 'SyntheticPassword!234' === $GLOBALS['passwords']['new@example.invalid'], 'expired reset token is rejected without changing credentials' );
$forgot_again = request( $controller, 'forgot_password', array( 'email' => 'new@example.invalid' ) );
check( 202 === $forgot_again->status, 'eligible account can request a fresh reset capability after expiry' );
$reset_token = mail_token();
$weak_reset = request( $controller, 'reset_password', array( 'token' => $reset_token, 'password' => 'weakpassword' ), $bridge );
check( 400 === $weak_reset->status && 'weak_password' === $weak_reset->data['error']['code'] && 'SyntheticPassword!234' === $GLOBALS['passwords']['new@example.invalid'], 'weak reset password returns the shared validation code without changing credentials' );
check( $weak_reset->data['error']['message'] === $weak->data['error']['message'], 'registration and password reset describe the same password policy' );
$old_session = WP_Session_Tokens::get_instance( $user->ID )->create( time() + HOUR_IN_SECONDS );
$reset = request( $controller, 'reset_password', array( 'token' => $reset_token, 'password' => 'RenewedPassword!456' ), $bridge );
check( 200 === $reset->status && 'RenewedPassword!456' === $GLOBALS['passwords']['new@example.invalid'], 'valid one-time reset changes the synthetic account password' );
check( ! WP_Session_Tokens::get_instance( $user->ID )->verify( $old_session ), 'password reset revokes all existing sessions' );
$reset_replay = request( $controller, 'reset_password', array( 'token' => $reset_token, 'password' => 'AnotherPassword!789' ), $bridge );
check( 400 === $reset_replay->status, 'password reset capability cannot be replayed' );
$old_login = request( $controller, 'login', array( 'email' => 'new@example.invalid', 'password' => 'SyntheticPassword!234' ) );
$new_login = request( $controller, 'login', array( 'email' => 'new@example.invalid', 'password' => 'RenewedPassword!456' ) );
check( 401 === $old_login->status && 200 === $new_login->status, 'old password no longer authenticates and new password does' );

$reset_lockout = null;
for ( $i = 0; $i < 6; ++$i ) {
	$_SERVER['REMOTE_ADDR'] = '198.51.100.71';
	$reset_lockout = request( $controller, 'forgot_password', array( 'email' => 'new@example.invalid' ) );
}
check( 429 === $reset_lockout->status, 'password reset requests are rate limited by IP and email' );

$_SERVER['REMOTE_ADDR'] = '198.51.100.72';
$registration_lockout = null;
for ( $i = 0; $i < 6; ++$i ) {
	$registration_lockout = request( $controller, 'register_account', array( 'name' => '', 'email' => '', 'password' => '' ) );
}
check( 429 === $registration_lockout->status, 'registration attempts are rate limited without creating an account' );

echo 'PASS: ' . $GLOBALS['assertions'] . " WordPress registration and recovery assertions\n";
