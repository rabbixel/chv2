<?php
/** Synthetic-only tests for verified EDD guest customer claiming. */

define( 'ABSPATH', __DIR__ );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'DAY_IN_SECONDS', 86400 );

class WP_REST_Server { const CREATABLE = 'POST'; }
class WP_Error { public $code; public function __construct( $code ) { $this->code = $code; } }
class FakeResponse { public $data; public $status; public function __construct( $data, $status ) { $this->data = $data; $this->status = $status; } }
class WP_User {
	public $ID; public $user_login; public $user_email; public $user_registered; public $first_name; public $last_name;
	public function __construct( $id, $login, $email ) { $this->ID = $id; $this->user_login = $login; $this->user_email = $email; $this->user_registered = '2024-01-02 03:04:05'; }
}
class FakeRequest {
	private $params; private $headers;
	public function __construct( $params = array(), $headers = array() ) { $this->params = $params; $this->headers = $headers; }
	public function get_param( $key ) { return $this->params[ $key ] ?? null; }
	public function get_header( $key ) { return $this->headers[ strtolower( $key ) ] ?? ''; }
}
class FakeSessionTokens {
	private $user_id;
	public function __construct( $user_id ) { $this->user_id = $user_id; }
	public function create( $expiration ) { $token = str_repeat( 'A', 43 ); $GLOBALS['session_tokens'][ $this->user_id ] = $token; return $token; }
	public function verify( $token ) { return isset( $GLOBALS['session_tokens'][ $this->user_id ] ) && hash_equals( $GLOBALS['session_tokens'][ $this->user_id ], $token ); }
}
class WP_Session_Tokens { public static function get_instance( $user_id ) { return new FakeSessionTokens( $user_id ); } }
class FakeEddCustomer {
	private $id;
	public function __construct( $id ) { $this->id = $id; }
	public function update( $data ) { if ( ! isset( $GLOBALS['customers'][ $this->id ] ) ) return false; $GLOBALS['customers'][ $this->id ]->user_id = (int) $data['user_id']; return true; }
}
class FakeWpdb {
	public $prefix = 'wp_'; public $users = 'wp_users'; public $locked = false; public $fail_lock = false; public $queries = array();
	public function prepare( $query, ...$args ) {
		foreach ( $args as $arg ) {
			$replacement = is_int( $arg ) ? (string) $arg : "'" . addslashes( (string) $arg ) . "'";
			$query = preg_replace( '/%[sd]/', $replacement, $query, 1 );
		}
		return $query;
	}
	public function get_col( $query ) {
		$email = $this->quoted_email( $query );
		$ids = array();
		foreach ( $GLOBALS['customers'] as $customer ) if ( strtolower( $customer->email ) === $email ) $ids[] = $customer->id;
		foreach ( $GLOBALS['secondary_emails'] as $row ) if ( 'active' === $row['status'] && strtolower( $row['email'] ) === $email ) $ids[] = $row['customer_id'];
		return array_values( array_unique( $ids ) );
	}
	public function get_row( $query ) {
		if ( preg_match( '/WHERE id = ([0-9]+)/', $query, $m ) ) return $GLOBALS['customers'][ (int) $m[1] ] ?? null;
		return null;
	}
	public function get_var( $query ) {
		if ( false !== strpos( $query, 'GET_LOCK' ) ) { if ( $this->fail_lock || $this->locked ) return 0; $this->locked = true; return 1; }
		if ( false !== strpos( $query, 'RELEASE_LOCK' ) ) { $this->locked = false; return 1; }
		if ( false !== strpos( $query, 'COUNT(ID)' ) ) { $email = $this->quoted_email( $query ); $count = 0; foreach ( $GLOBALS['users'] as $user ) if ( strtolower( $user->user_email ) === $email ) $count++; return $count; }
		if ( preg_match( '/WHERE user_id = ([0-9]+) AND id <> ([0-9]+)/', $query, $m ) ) { foreach ( $GLOBALS['customers'] as $customer ) if ( (int) $customer->user_id === (int) $m[1] && (int) $customer->id !== (int) $m[2] ) return $customer->id; }
		return null;
	}
	public function query( $query ) { $this->queries[] = $query; return 0; }
	private function quoted_email( $query ) { return preg_match( "/LOWER\(email\) = '([^']*)'/", $query, $m ) ? strtolower( stripslashes( $m[1] ) ) : ( preg_match( "/LOWER\(user_email\) = '([^']*)'/", $query, $m ) ? strtolower( stripslashes( $m[1] ) ) : '' ); }
}

$GLOBALS['routes'] = array();
$GLOBALS['customers'] = array();
$GLOBALS['secondary_emails'] = array();
$GLOBALS['users'] = array();
$GLOBALS['transients'] = array();
$GLOBALS['sent_mail'] = array();
$GLOBALS['session_tokens'] = array();
$GLOBALS['next_user_id'] = 100;
$GLOBALS['wpdb'] = new FakeWpdb();
putenv( 'CH_AUTH_FRONTEND_URL=http://localhost:3000' );

function register_rest_route( $namespace, $route, $args ) { $GLOBALS['routes'][] = $route; }
function sanitize_email( $email ) { return filter_var( $email, FILTER_VALIDATE_EMAIL ) ? $email : ''; }
function is_email( $email ) { return false !== filter_var( $email, FILTER_VALIDATE_EMAIL ); }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_user( $value, $strict = false ) { return preg_replace( '/[^a-z0-9_.-]/i', '', strtolower( (string) $value ) ); }
function absint( $value ) { return abs( (int) $value ); }
function wp_salt( $scheme = '' ) { return 'synthetic-test-salt'; }
function wp_parse_url( $url ) { return parse_url( $url ); }
function wp_get_environment_type() { return 'local'; }
function wp_set_current_user( $user_id ) { $GLOBALS['current_user_id'] = (int) $user_id; }
function wp_mail( $to, $subject, $message ) { $GLOBALS['sent_mail'][] = array( 'to' => $to, 'subject' => $subject, 'message' => $message ); return true; }
function get_transient( $key ) { $record = $GLOBALS['transients'][ $key ] ?? false; if ( is_array( $record ) && isset( $record['_expires'] ) && $record['_expires'] < time() ) { unset( $GLOBALS['transients'][ $key ] ); return false; } return is_array( $record ) && array_key_exists( '_value', $record ) ? $record['_value'] : $record; }
function set_transient( $key, $value, $ttl ) { $GLOBALS['transients'][ $key ] = array( '_value' => $value, '_expires' => time() + $ttl ); return true; }
function delete_transient( $key ) { unset( $GLOBALS['transients'][ $key ] ); return true; }
function get_user_by( $field, $value ) { foreach ( $GLOBALS['users'] as $user ) if ( ( 'id' === $field && (int) $user->ID === (int) $value ) || ( 'email' === $field && strtolower( $user->user_email ) === strtolower( $value ) ) ) return $user; return false; }
function username_exists( $name ) { foreach ( $GLOBALS['users'] as $user ) if ( $user->user_login === $name ) return true; return false; }
function get_user_meta( $user_id, $key, $single = true ) { $user = get_user_by( 'id', $user_id ); return $user ? ( 'first_name' === $key ? ( $user->first_name ?? '' ) : ( $user->last_name ?? '' ) ) : ''; }
function wp_generate_password( $length = 12, $special = true, $extra = false ) { return str_repeat( 'R', $length ); }
function wp_insert_user( $data ) { if ( get_user_by( 'email', $data['user_email'] ) ) return new WP_Error( 'existing_email' ); $user = new WP_User( ++$GLOBALS['next_user_id'], $data['user_login'], $data['user_email'] ); $user->first_name = $data['first_name']; $user->last_name = $data['last_name']; $GLOBALS['users'][ $user->ID ] = $user; return $user->ID; }
function edd_get_customer( $id ) { return isset( $GLOBALS['customers'][ $id ] ) ? new FakeEddCustomer( $id ) : false; }
function edd_get_customer_by( $field, $value ) { foreach ( $GLOBALS['customers'] as $customer ) if ( ( 'user_id' === $field && (int) $customer->user_id === (int) $value ) ) return new FakeEddCustomer( $customer->id ); return false; }

final class CH_API {
	public const NAMESPACE = 'ch/v1';
	public static function success( $data, $status = 200 ) { return new FakeResponse( array( 'success' => true, 'data' => $data ), $status ); }
	public static function error( $code, $message, $status ) { return new FakeResponse( array( 'success' => false, 'error' => array( 'code' => $code, 'message' => $message ) ), $status ); }
}
require_once __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-auth-controller.php';
require_once __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-claim-controller.php';

function expect( $condition, $message ) { if ( ! $condition ) { fwrite( STDERR, "FAIL: {$message}\n" ); exit( 1 ); } $GLOBALS['assertions']++; }
function customer_fixture( $id, $email, $user_id = 0, $name = 'Synthetic Guest' ) { $GLOBALS['customers'][ $id ] = (object) array( 'id' => $id, 'email' => $email, 'user_id' => $user_id, 'name' => $name, 'status' => 'active' ); }
function add_user_fixture( $id, $email ) { $GLOBALS['users'][ $id ] = new WP_User( $id, 'account' . $id, $email ); return $GLOBALS['users'][ $id ]; }
function request_fixture( $email, $ip ) { $_SERVER['REMOTE_ADDR'] = $ip; return $GLOBALS['claim_controller']->request_claim( new FakeRequest( array( 'email' => $email, 'frontend_origin' => 'http://localhost:3000' ) ) ); }
function token_from_last_mail() { preg_match( '~#([a-f0-9]{64})~', end( $GLOBALS['sent_mail'] )['message'], $m ); return $m[1] ?? ''; }
function claim_fixture( $token, $extra = array(), $authorization = '' ) { $_SERVER['REMOTE_ADDR'] = '198.51.100.220'; $headers = $authorization ? array( 'authorization' => $authorization ) : array(); return $GLOBALS['claim_controller']->complete_claim( new FakeRequest( array_merge( array( 'token' => $token ), $extra ), $headers ) ); }

$GLOBALS['assertions'] = 0;
$auth_stub = new class {
	public function bridge_permission( $request ) { return true; }
};
$GLOBALS['claim_controller'] = new CH_Claim_Controller( $auth_stub );
$GLOBALS['claim_controller']->register_routes();
expect( in_array( '/customer/claim/request', $GLOBALS['routes'], true ), 'registers claim request route' );
expect( in_array( '/customer/claim/complete', $GLOBALS['routes'], true ), 'registers claim completion route' );

$unknown = request_fixture( 'nobody@example.test', '198.51.100.1' );
expect( 202 === $unknown->status, 'unknown email receives accepted response' );
expect( 0 === count( $GLOBALS['sent_mail'] ), 'unknown email does not send mail' );

customer_fixture( 101, 'guest@example.test' );
$eligible = request_fixture( 'GUEST@example.test', '198.51.100.2' );
expect( 202 === $eligible->status && 1 === count( $GLOBALS['sent_mail'] ), 'eligible guest receives synthetic verification message' );
expect( $eligible->data['data']['message'] === $unknown->data['data']['message'], 'eligible and unknown emails receive identical public message' );
$token = token_from_last_mail();
expect( 64 === strlen( $token ), 'verification token has 256 bits of random hex' );
expect( false === strpos( serialize( $GLOBALS['transients'] ), $token ), 'raw verification token is not stored in transients' );

$bad_token = claim_fixture( str_repeat( 'f', 64 ), array( 'first_name' => 'Synthetic', 'password' => 'SyntheticPassword!234' ) );
expect( 400 === $bad_token->status, 'invalid token is rejected' );
$token_key = 'ch_claim_token_' . hash( 'sha256', $token );
$token_data = get_transient( $token_key );
$token_data['expires_at'] = time() - 1;
set_transient( $token_key, $token_data, 1800 );
$expired = claim_fixture( $token, array( 'first_name' => 'Synthetic', 'password' => 'SyntheticPassword!234' ) );
expect( 400 === $expired->status, 'expired token is rejected' );

// Request a fresh synthetic link and create the first WP user + EDD link.
$again = request_fixture( 'guest@example.test', '198.51.100.3' );
$new_token = token_from_last_mail();
$created = claim_fixture( $new_token, array( 'first_name' => 'Synthetic', 'last_name' => 'Buyer', 'password' => 'SyntheticPassword!234' ) );
expect( 200 === $created->status, 'verified guest can create a WordPress account' );
expect( (int) $GLOBALS['customers'][101]->user_id === (int) $created->data['data']['user']['id'], 'new account links only the selected EDD customer' );
expect( ! empty( $created->data['data']['session']['token'] ), 'new account receives a native-style session response' );
$reused = claim_fixture( $new_token, array( 'first_name' => 'Synthetic', 'password' => 'SyntheticPassword!234' ) );
expect( 400 === $reused->status, 'verification token cannot be reused' );

// Existing WordPress account must authenticate before the EDD link is set.
customer_fixture( 102, 'existing@example.test' );
$existing_user = add_user_fixture( 202, 'existing@example.test' );
request_fixture( 'existing@example.test', '198.51.100.4' );
$existing_token = token_from_last_mail();
$needs_login = claim_fixture( $existing_token, array() );
expect( 409 === $needs_login->status && 'claim_login_required' === $needs_login->data['error']['code'], 'existing account is required to authenticate' );
expect( 0 === (int) $GLOBALS['customers'][102]->user_id, 'existing account record stays unlinked before authentication' );
$login_token = WP_Session_Tokens::get_instance( 202 )->create( time() + HOUR_IN_SECONDS );
$linked = claim_fixture( $existing_token, array(), 'Bearer 202.' . $login_token );
expect( 200 === $linked->status && 202 === (int) $GLOBALS['customers'][102]->user_id, 'authenticated matching WordPress user links the customer' );

// A logged-in account with a different email cannot claim the verified record.
customer_fixture( 103, 'mismatch@example.test' );
$wrong_user = add_user_fixture( 203, 'different@example.test' );
request_fixture( 'mismatch@example.test', '198.51.100.5' );
$mismatch_token = token_from_last_mail();
$wrong_session = WP_Session_Tokens::get_instance( 203 )->create( time() + HOUR_IN_SECONDS );
$mismatch = claim_fixture( $mismatch_token, array( 'first_name' => 'Synthetic', 'password' => 'SyntheticPassword!234' ), 'Bearer 203.' . $wrong_session );
expect( 409 === $mismatch->status && 0 === (int) $GLOBALS['customers'][103]->user_id, 'email mismatch cannot link another account' );

// A user already associated with a different EDD row cannot merge identities.
customer_fixture( 104, 'conflict@example.test' );
customer_fixture( 204, 'older-address@example.test', 204 );
$conflict_user = add_user_fixture( 204, 'conflict@example.test' );
request_fixture( 'conflict@example.test', '198.51.100.6' );
$conflict_token = token_from_last_mail();
$conflict_session = WP_Session_Tokens::get_instance( 204 )->create( time() + HOUR_IN_SECONDS );
$ownership_conflict = claim_fixture( $conflict_token, array(), 'Bearer 204.' . $conflict_session );
expect( 409 === $ownership_conflict->status && 0 === (int) $GLOBALS['customers'][104]->user_id, 'pre-existing customer association blocks cross-linking' );

// Already-linked customers and ambiguous secondary-email matches are not issued tokens.
$mail_count = count( $GLOBALS['sent_mail'] );
customer_fixture( 105, 'linked@example.test', 777 );
request_fixture( 'linked@example.test', '198.51.100.7' );
expect( $mail_count === count( $GLOBALS['sent_mail'] ), 'already-linked customer receives no claim email' );
customer_fixture( 106, 'another@example.test' );
$GLOBALS['secondary_emails'][] = array( 'customer_id' => 106, 'email' => 'shared@example.test', 'status' => 'active' );
$GLOBALS['secondary_emails'][] = array( 'customer_id' => 107, 'email' => 'shared@example.test', 'status' => 'active' );
request_fixture( 'shared@example.test', '198.51.100.8' );
expect( $mail_count === count( $GLOBALS['sent_mail'] ), 'ambiguous secondary emails do not receive claim links' );

// Two attempts on the same capability serialize; the first successful claim wins.
customer_fixture( 108, 'race@example.test' );
request_fixture( 'race@example.test', '198.51.100.9' );
$race_token = token_from_last_mail();
$GLOBALS['wpdb']->fail_lock = true;
$locked = claim_fixture( $race_token, array( 'first_name' => 'Race', 'password' => 'SyntheticPassword!234' ) );
$GLOBALS['wpdb']->fail_lock = false;
expect( 400 === $locked->status && 0 === (int) $GLOBALS['customers'][108]->user_id, 'concurrent lock failure leaves association untouched' );
$race_winner = claim_fixture( $race_token, array( 'first_name' => 'Race', 'password' => 'SyntheticPassword!234' ) );
$race_loser = claim_fixture( $race_token, array( 'first_name' => 'Race', 'password' => 'SyntheticPassword!234' ) );
expect( 200 === $race_winner->status && 400 === $race_loser->status, 'only one concurrent/replayed verification can claim a record' );

// The EDD email changing after token issue invalidates the capability.
customer_fixture( 109, 'before@example.test' );
request_fixture( 'before@example.test', '198.51.100.10' );
$changed_token = token_from_last_mail();
$GLOBALS['customers'][109]->email = 'after@example.test';
$changed_email = claim_fixture( $changed_token, array( 'first_name' => 'Synthetic', 'password' => 'SyntheticPassword!234' ) );
expect( 400 === $changed_email->status && 0 === (int) $GLOBALS['customers'][109]->user_id, 'changed primary email invalidates an outstanding token' );

echo 'PASS: ' . $GLOBALS['assertions'] . " guest customer claim assertions\n";
