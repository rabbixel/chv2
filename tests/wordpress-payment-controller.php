<?php
/** Synthetic Razorpay controller tests. No WordPress database or provider is contacted. */
define( 'ABSPATH', __DIR__ );
define( 'HOUR_IN_SECONDS', 3600 );
class WP_REST_Server { const CREATABLE = 'POST'; }
class WP_REST_Response { public $data; public $status; public function __construct( $data, $status = 200 ) { $this->data = $data; $this->status = $status; } public function header( $key, $value ) {} public function get_status() { return $this->status; } public function get_data() { return $this->data; } }
class WP_Error { public function __construct( $code ) {} }
class CH_API { const NAMESPACE = 'ch/v1'; public static function success( $data, $status = 200 ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data ), $status ); } public static function error( $code, $message, $status ) { return new WP_REST_Response( array( 'success' => false, 'error' => array( 'code' => $code, 'message' => $message ) ), $status ); } }
class Request { private $p; public function __construct( $p ) { $this->p = $p; } public function get_param( $key ) { return $this->p[ $key ] ?? null; } public function get_header( $key ) { return ''; } }
class Auth { public function bridge_permission( $request ) { return true; } public function session_permission( $request ) { return true; } }
class FakeOrder { public $id; public $user_id; public $type; public $status; public $currency; public $total; public function __construct( $data ) { foreach ( $data as $key => $value ) { $this->$key = $value; } } public function get_number() { return 'CH-' . $this->id; } }
class FakeDb { public $busy = false; public function prepare( $sql, ...$args ) { return array( $sql, $args ); } public function get_var( $query ) { if ( strpos( $query[0], 'GET_LOCK' ) !== false ) { return $this->busy ? '0' : '1'; } return '1'; } }
function register_rest_route( ...$args ) {}
function rest_ensure_response( $response ) { return $response; }
function absint( $value ) { return abs( (int) $value ); }
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_key( $value ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) ); }
function get_current_user_id() { return $GLOBALS['user_id']; }
function edd_get_currency() { return $GLOBALS['currency']; }
function edd_get_order( $id ) { return $GLOBALS['orders'][ $id ] ?? false; }
function edd_get_order_meta( $id, $key, $single = true ) { return $GLOBALS['meta'][ $id ][ $key ] ?? ''; }
function edd_update_order_meta( $id, $key, $value ) { $GLOBALS['meta'][ $id ][ $key ] = $value; return true; }
function get_transient( $key ) { return $GLOBALS['transients'][ $key ] ?? false; }
function set_transient( $key, $value, $ttl ) { $GLOBALS['transients'][ $key ] = $value; return true; }
function wp_json_encode( $data ) { return json_encode( $data ); }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function wp_remote_post( $url, $args ) { $GLOBALS['calls']++; $GLOBALS['sent'] = json_decode( $args['body'], true ); return $GLOBALS['provider']; }
function wp_remote_get( $url, $args ) { $GLOBALS['get_calls']++; $GLOBALS['requested_url'] = $url; return $GLOBALS['payment_provider']; }
function wp_remote_retrieve_response_code( $response ) { return $response['code']; }
function wp_remote_retrieve_body( $response ) { return $response['body']; }
require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-payment-controller.php';

function reset_fixture( $order = array() ) {
	$GLOBALS['wpdb'] = new FakeDb(); $GLOBALS['user_id'] = 0; $GLOBALS['currency'] = 'INR'; $GLOBALS['calls'] = 0; $GLOBALS['get_calls'] = 0; $GLOBALS['meta'] = array(); $GLOBALS['transients'] = array();
	$GLOBALS['orders'] = array( 10 => new FakeOrder( array_merge( array( 'id' => 10, 'user_id' => 0, 'type' => 'sale', 'status' => 'pending', 'currency' => 'INR', 'total' => '12.50' ), $order ) ) );
	$GLOBALS['meta'][10]['ch_payment_authorization_hash'] = hash( 'sha256', str_repeat( 'a', 64 ) );
	$GLOBALS['provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'order_test123', 'amount' => 1250, 'currency' => 'INR' ) ) );
	$GLOBALS['payment_provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_test123', 'amount' => 1250, 'currency' => 'INR', 'status' => 'captured', 'captured' => true ) ) );
}
function call_payment( $id = 10 ) { return ( new CH_Payment_Controller( new Auth() ) )->create_order( new Request( array( 'order_id' => $id, 'authorization_token' => str_repeat( 'a', 64 ), 'amount' => 1, 'currency' => 'USD' ) ) ); }
function call_verify( $overrides = array(), $id = 10 ) {
	$GLOBALS['meta'][10]['ch_razorpay_order_id'] = 'order_test123';
	$GLOBALS['meta'][10]['ch_razorpay_amount_paise'] = 1250;
	$params = array_merge( array( 'order_id' => $id, 'authorization_token' => str_repeat( 'a', 64 ), 'razorpay_payment_id' => 'pay_test123', 'razorpay_order_id' => 'order_test123', 'razorpay_signature' => hash_hmac( 'sha256', 'order_test123|pay_test123', 'synthetic-secret-value' ) ), $overrides );
	return ( new CH_Payment_Controller( new Auth() ) )->verify_payment( new Request( $params ) );
}
function expect( $condition, $message ) { if ( ! $condition ) { fwrite( STDERR, "FAIL: $message\n" ); exit( 1 ); } }

putenv( 'CH_RAZORPAY_TEST_KEY_ID=rzp_test_synthetic' ); putenv( 'CH_RAZORPAY_TEST_KEY_SECRET=synthetic-secret-value' );
reset_fixture(); $ok = call_payment(); expect( 200 === $ok->status && 1250 === $ok->data['data']['amount'] && 'INR' === $ok->data['data']['currency'], 'valid order amount comes from EDD, not request' );
expect( 1250 === $GLOBALS['sent']['amount'] && 'created' === $GLOBALS['meta'][10]['ch_razorpay_creation_state'] && 'order_test123' === $GLOBALS['meta'][10]['ch_razorpay_order_id'], 'EDD amount is sent and provider order id stored on EDD order' );
expect( 'creative-hatti-api-test' === $GLOBALS['sent']['notes']['ch_integration'] && '10' === $GLOBALS['sent']['notes']['ch_edd_order_id'] && ! isset( $GLOBALS['sent']['notes']['edd_order_id'] ), 'custom test orders do not expose the legacy EDD webhook mapping key' );
expect( 'pending' === $GLOBALS['orders'][10]->status, 'creating a Razorpay order does not complete the EDD order' );
$again = call_payment(); expect( 200 === $again->status && 1 === $GLOBALS['calls'], 'retry reuses existing Razorpay order' );

reset_fixture( array( 'user_id' => 7 ) ); $GLOBALS['user_id'] = 8; expect( 404 === call_payment()->status, 'authenticated customer cannot use another account order capability' );
reset_fixture(); $GLOBALS['user_id'] = 7; expect( 200 === call_payment()->status, 'guest order capability remains usable after sign-in' );
reset_fixture(); $GLOBALS['meta'][10]['ch_payment_authorization_hash'] = hash( 'sha256', str_repeat( 'b', 64 ) ); expect( 404 === call_payment()->status, 'tampered capability rejected' );
reset_fixture( array( 'currency' => 'USD' ) ); expect( 409 === call_payment()->status, 'non-INR EDD order rejected' );
reset_fixture(); $GLOBALS['currency'] = 'USD'; expect( 409 === call_payment()->status, 'non-INR store currency rejected' );
reset_fixture( array( 'total' => '0.00' ) ); expect( 409 === call_payment()->status, 'zero total rejected' );
reset_fixture( array( 'status' => 'complete' ) ); expect( 409 === call_payment()->status, 'completed order rejected' );
reset_fixture( array( 'status' => 'refunded' ) ); expect( 409 === call_payment()->status, 'refunded order rejected' );
reset_fixture( array( 'total' => '12.345' ) ); expect( 409 === call_payment()->status, 'unsupported decimal precision rejected' );
reset_fixture( array( 'total' => '12.500000000' ) ); expect( 200 === call_payment()->status && 1250 === $GLOBALS['sent']['amount'], 'EDD trailing precision zeros convert precisely to paise' );
reset_fixture( array( 'total' => '12.505000000' ) ); expect( 409 === call_payment()->status, 'fractional paise are rejected without rounding' );

reset_fixture(); putenv( 'CH_RAZORPAY_TEST_KEY_ID=' ); expect( 503 === call_payment()->status && 0 === $GLOBALS['calls'], 'missing credentials fail safely' );
putenv( 'CH_RAZORPAY_TEST_KEY_ID=rzp_test_synthetic' ); reset_fixture(); $GLOBALS['provider'] = array( 'code' => 400, 'body' => '{}' ); expect( 502 === call_payment()->status && 'rejected' === $GLOBALS['meta'][10]['ch_razorpay_creation_state'], 'provider rejection recorded without exposing details' );
reset_fixture(); $GLOBALS['provider'] = new WP_Error( 'timeout' ); expect( 503 === call_payment()->status && 'uncertain' === $GLOBALS['meta'][10]['ch_razorpay_creation_state'], 'timeout marked uncertain' );
expect( 503 === call_payment()->status && 1 === $GLOBALS['calls'], 'uncertain outcome blocks duplicate provider call' );
reset_fixture(); $GLOBALS['wpdb']->busy = true; expect( 503 === call_payment()->status && 0 === $GLOBALS['calls'], 'concurrent request rejected by per-order lock' );
reset_fixture(); $GLOBALS['provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'order_test123', 'amount' => 1251, 'currency' => 'INR' ) ) ); expect( 503 === call_payment()->status && 'uncertain' === $GLOBALS['meta'][10]['ch_razorpay_creation_state'], 'provider response mismatch marked uncertain' );

reset_fixture(); $verified = call_verify(); expect( 200 === $verified->status && 'captured' === $verified->data['data']['status'] && false === $verified->data['data']['fulfilled'], 'captured payment is verified and recorded without fulfillment' );
expect( 'https://api.razorpay.com/v1/payments/pay_test123' === $GLOBALS['requested_url'], 'payment details are fetched by the signed payment ID from Razorpay' );
expect( 'pending' === $GLOBALS['orders'][10]->status && 'pay_test123' === $GLOBALS['meta'][10]['ch_razorpay_verified_payment_id'], 'captured verification leaves EDD pending and records payment ID' );
$duplicate = call_verify(); expect( 200 === $duplicate->status && 1 === $GLOBALS['get_calls'], 'duplicate verification is idempotent and does not call provider again' );
reset_fixture(); expect( 400 === call_verify( array( 'razorpay_signature' => str_repeat( '0', 64 ) ) )->status && 0 === $GLOBALS['get_calls'], 'invalid signature rejected before provider call' );
reset_fixture(); expect( 404 === call_verify( array( 'razorpay_order_id' => 'order_other123' ) )->status && 0 === $GLOBALS['get_calls'], 'wrong Razorpay order ID rejected' );
reset_fixture(); $GLOBALS['payment_provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_other123', 'amount' => 1250, 'currency' => 'INR', 'status' => 'captured', 'captured' => true ) ) ); expect( 409 === call_verify()->status && empty( $GLOBALS['meta'][10]['ch_razorpay_verified_payment_id'] ), 'provider payment attached to a different order is rejected' );
reset_fixture(); $GLOBALS['payment_provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_test123', 'amount' => 1251, 'currency' => 'INR', 'status' => 'captured' ) ) ); expect( 409 === call_verify()->status && empty( $GLOBALS['meta'][10]['ch_razorpay_verified_payment_id'] ), 'wrong payment amount is rejected' );
reset_fixture(); $GLOBALS['payment_provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_test123', 'amount' => 1250, 'currency' => 'USD', 'status' => 'captured' ) ) ); expect( 409 === call_verify()->status, 'wrong payment currency is rejected' );
reset_fixture( array( 'user_id' => 7 ) ); $GLOBALS['user_id'] = 8; expect( 404 === call_verify()->status && 0 === $GLOBALS['get_calls'], 'cross-customer verification rejected' );
reset_fixture( array( 'user_id' => 7 ) ); $GLOBALS['user_id'] = 7; expect( 200 === call_verify()->status, 'authenticated customer can verify their own order' );
foreach ( array( 'pending', 'failed' ) as $state ) { reset_fixture(); $GLOBALS['payment_provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_test123', 'amount' => 1250, 'currency' => 'INR', 'status' => $state ) ) ); expect( 409 === call_verify()->status && empty( $GLOBALS['meta'][10]['ch_razorpay_verified_payment_id'] ), $state . ' payment not recorded as authorized/captured' ); }
reset_fixture(); $GLOBALS['payment_provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_test123', 'amount' => 1250, 'currency' => 'INR', 'status' => 'authorized', 'captured' => false ) ) ); $authorized = call_verify(); expect( 200 === $authorized->status && 'authorized' === $authorized->data['data']['status'] && 'pending' === $GLOBALS['orders'][10]->status, 'authorized payment is recorded as authorized but remains unfulfilled' );
$GLOBALS['payment_provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_test123', 'amount' => 1250, 'currency' => 'INR', 'status' => 'captured', 'captured' => true ) ) ); $captured_later = call_verify(); expect( 200 === $captured_later->status && 'captured' === $captured_later->data['data']['status'] && 'captured' === $GLOBALS['meta'][10]['ch_razorpay_verified_payment_status'] && 'pending' === $GLOBALS['orders'][10]->status, 'authorized payment can later be verified as captured without fulfillment' );
reset_fixture(); $GLOBALS['payment_provider'] = new WP_Error( 'provider' ); expect( 503 === call_verify()->status && empty( $GLOBALS['meta'][10]['ch_razorpay_verified_payment_id'] ), 'provider API error does not record payment' );
reset_fixture(); $GLOBALS['payment_provider'] = array( 'code' => 502, 'body' => '{}' ); expect( 503 === call_verify()->status && empty( $GLOBALS['meta'][10]['ch_razorpay_verified_payment_id'] ), 'provider HTTP failure does not record payment' );
reset_fixture(); $GLOBALS['wpdb']->busy = true; expect( 503 === call_verify()->status && 0 === $GLOBALS['get_calls'], 'concurrent verification is stopped by the order lock' );
reset_fixture(); call_verify(); expect( 409 === call_verify( array( 'razorpay_payment_id' => 'pay_other123', 'razorpay_signature' => hash_hmac( 'sha256', 'order_test123|pay_other123', 'synthetic-secret-value' ) ) )->status, 'different payment cannot replace an already verified payment' );

putenv( 'CH_RAZORPAY_TEST_KEY_ID' ); putenv( 'CH_RAZORPAY_TEST_KEY_SECRET' );
echo "Razorpay payment controller tests passed.\n";
