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
class FakeOrder { public $id; public $user_id; public $type; public $status; public $currency; public $total; public $gateway; public $email; public function __construct( $data ) { foreach ( $data as $key => $value ) { $this->$key = $value; } } public function get_number() { return 'CH-' . $this->id; } }
class FakeDownload { public function get_files_for_price_id( $price_id ) { return array( 'main' => array( 'name' => 'Synthetic asset', 'file' => 's3://private/synthetic.zip' ) ); } }
class FakeDb { public $busy = false; public $prefix = 'wp_'; public function prepare( $sql, ...$args ) { return array( $sql, $args ); } public function get_var( $query ) { if ( strpos( $query[0], 'GET_LOCK' ) !== false ) { return $this->busy ? '0' : '1'; } if ( strpos( $query[0], 'COALESCE(SUM' ) !== false ) { return $GLOBALS['reserved_qty'] ?? 0; } return '1'; } }
function register_rest_route( ...$args ) {}
function add_filter( ...$args ) {}
function rest_ensure_response( $response ) { return $response; }
function absint( $value ) { return abs( (int) $value ); }
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_key( $value ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) ); }
function get_current_user_id() { return $GLOBALS['user_id']; }
function get_post_meta( $id, $key, $single = true ) { if ( '_edd_purchase_limit' === $key ) { return $GLOBALS['limits'][ $id ] ?? ''; } if ( '_edd_download_sales' === $key ) { return (string) ( $GLOBALS['sales'][ $id ] ?? 0 ); } return ''; }
function edd_get_download_sales_stats( $id ) { return $GLOBALS['sales'][ $id ] ?? 0; }
function edd_get_currency() { return $GLOBALS['currency']; }
function edd_get_order( $id ) { return $GLOBALS['orders'][ $id ] ?? false; }
function edd_get_order_meta( $id, $key, $single = true ) { return $GLOBALS['meta'][ $id ][ $key ] ?? ''; }
function edd_get_order_items( $args ) { return array_values( array_filter( $GLOBALS['order_items'] ?? array(), static function ( $item ) use ( $args ) { return (int) $item->order_id === (int) $args['order_id'] && ( empty( $args['status__in'] ) || in_array( $item->status, $args['status__in'], true ) ); } ) ); }
function edd_get_order_item( $id ) { return $GLOBALS['order_items'][ $id ] ?? false; }
function edd_get_download( $id ) { return new FakeDownload(); }
function edd_get_file_name( $file ) { return $file['name']; }
function edd_get_download_file_url( $item, $email, $file_key ) { $GLOBALS['download_url_args'] = array( $item, $email, $file_key ); return 'http://creativehatti.test/index.php?eddfile=native'; }
function get_post_status( $id ) { return 'publish'; }
function get_the_title( $id ) { return 'Synthetic product'; }
function esc_url_raw( $url ) { return $url; }
function edd_update_order_meta( $id, $key, $value ) { $GLOBALS['meta'][ $id ][ $key ] = $value; return true; }
function edd_get_order_transaction_by( $field, $value ) { foreach ( $GLOBALS['transactions'] as $transaction ) { if ( isset( $transaction->$field ) && (string) $transaction->$field === (string) $value ) { return $transaction; } } return false; }
function edd_add_order_transaction( $data ) { if ( ! empty( $GLOBALS['transaction_fail'] ) ) { return false; } $transaction = (object) $data; $GLOBALS['transactions'][] = $transaction; return count( $GLOBALS['transactions'] ); }
function get_transient( $key ) { return $GLOBALS['transients'][ $key ] ?? false; }
function set_transient( $key, $value, $ttl ) { $GLOBALS['transients'][ $key ] = $value; return true; }
function wp_json_encode( $data ) { return json_encode( $data ); }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function wp_remote_post( $url, $args ) { $GLOBALS['calls']++; $GLOBALS['sent'] = json_decode( $args['body'], true ); return $GLOBALS['provider']; }
function wp_remote_get( $url, $args ) { $GLOBALS['get_calls']++; $GLOBALS['requested_url'] = $url; return $GLOBALS['payment_provider']; }
function wp_remote_retrieve_response_code( $response ) { return $response['code']; }
function wp_remote_retrieve_body( $response ) { return $response['body']; }
require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-purchase-limit-service.php';
require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-payment-controller.php';

function reset_fixture( $order = array() ) {
	$GLOBALS['wpdb'] = new FakeDb(); $GLOBALS['user_id'] = 0; $GLOBALS['currency'] = 'INR'; $GLOBALS['calls'] = 0; $GLOBALS['get_calls'] = 0; $GLOBALS['meta'] = array(); $GLOBALS['transients'] = array(); $GLOBALS['transactions'] = array(); $GLOBALS['transaction_fail'] = false; $GLOBALS['download_url_args'] = null; $GLOBALS['limits'] = array(); $GLOBALS['sales'] = array(); $GLOBALS['reserved_qty'] = 0;
	$GLOBALS['orders'] = array( 10 => new FakeOrder( array_merge( array( 'id' => 10, 'user_id' => 0, 'type' => 'sale', 'status' => 'pending', 'currency' => 'INR', 'total' => '12.50', 'gateway' => 'ch_razorpay' ), $order ) ) );
	$GLOBALS['orders'][10]->email = 'synthetic@example.test';
	$GLOBALS['order_items'] = array( 21 => (object) array( 'id' => 21, 'order_id' => 10, 'product_id' => 44, 'quantity' => 1, 'price_id' => 2, 'status' => 'complete' ), 22 => (object) array( 'id' => 22, 'order_id' => 11, 'product_id' => 44, 'quantity' => 1, 'price_id' => 2, 'status' => 'complete' ) );
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
function call_status( $overrides = array(), $id = 10 ) { return ( new CH_Payment_Controller( new Auth() ) )->order_status( new Request( array_merge( array( 'order_id' => $id, 'authorization_token' => str_repeat( 'a', 64 ) ), $overrides ) ) ); }
function expect( $condition, $message ) { if ( ! $condition ) { fwrite( STDERR, "FAIL: $message\n" ); exit( 1 ); } }

putenv( 'CH_RAZORPAY_TEST_KEY_ID=rzp_test_synthetic' ); putenv( 'CH_RAZORPAY_TEST_KEY_SECRET=synthetic-secret-value' );
reset_fixture(); $ok = call_payment(); expect( 200 === $ok->status && 1250 === $ok->data['data']['amount'] && 'INR' === $ok->data['data']['currency'], 'valid order amount comes from EDD, not request' );
expect( 1250 === $GLOBALS['sent']['amount'] && 'created' === $GLOBALS['meta'][10]['ch_razorpay_creation_state'] && 'order_test123' === $GLOBALS['meta'][10]['ch_razorpay_order_id'], 'EDD amount is sent and provider order id stored on EDD order' );
expect( 'creative-hatti-api-test' === $GLOBALS['sent']['notes']['ch_integration'] && '10' === $GLOBALS['sent']['notes']['ch_edd_order_id'] && ! isset( $GLOBALS['sent']['notes']['edd_order_id'] ), 'custom test orders do not expose the legacy EDD webhook mapping key' );
expect( 'pending' === $GLOBALS['orders'][10]->status, 'creating a Razorpay order does not complete the EDD order' );
$again = call_payment(); expect( 200 === $again->status && 1 === $GLOBALS['calls'], 'retry reuses existing Razorpay order' );
reset_fixture(); $GLOBALS['limits'][44] = '1'; $GLOBALS['sales'][44] = 1; expect( 409 === call_payment()->status && 0 === $GLOBALS['calls'], 'Razorpay preparation rejects an exhausted historical limit' );
reset_fixture(); $GLOBALS['limits'][44] = '1'; $GLOBALS['sales'][44] = 0; $GLOBALS['meta'][10]['ch_purchase_limit_reservation_expires_at'] = time() - 1; expect( 409 === call_payment()->status && 0 === $GLOBALS['calls'], 'expired order with no provider attempt cannot start a payment' );

reset_fixture( array( 'user_id' => 7 ) ); $GLOBALS['user_id'] = 8; expect( 404 === call_payment()->status, 'authenticated customer cannot use another account order capability' );
reset_fixture(); $GLOBALS['user_id'] = 7; expect( 200 === call_payment()->status, 'guest order capability remains usable after sign-in' );
reset_fixture(); $GLOBALS['meta'][10]['ch_payment_authorization_hash'] = hash( 'sha256', str_repeat( 'b', 64 ) ); expect( 404 === call_payment()->status, 'tampered capability rejected' );
reset_fixture(); expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->create_order( new Request( array( 'order_id' => 10, 'authorization_token' => '' ) ) )->status && 0 === $GLOBALS['calls'], 'missing payment capability rejected without Razorpay order creation' );
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
expect( 1 === count( $GLOBALS['transactions'] ) && 'pay_test123' === $GLOBALS['transactions'][0]->transaction_id && 'ch_razorpay' === $GLOBALS['transactions'][0]->gateway && 'complete' === $GLOBALS['transactions'][0]->status && 12.5 === $GLOBALS['transactions'][0]->total, 'captured payment is written once as a native custom-gateway EDD transaction' );
expect( false === $verified->data['data']['fulfilled'], 'automatic fulfillment defaults off when flag is absent' );
expect( 200 === call_status()->status && 'captured' === call_status()->data['data']['payment_status'] && false === call_status()->data['data']['fulfilled'], 'authorized order-status read reports verified payment without claiming completion' );
$duplicate = call_verify(); expect( 200 === $duplicate->status && 1 === $GLOBALS['get_calls'] && 1 === count( $GLOBALS['transactions'] ), 'duplicate verification is idempotent and does not call provider or add a transaction again' );
reset_fixture(); expect( 400 === call_verify( array( 'razorpay_signature' => str_repeat( '0', 64 ) ) )->status && 0 === $GLOBALS['get_calls'], 'invalid signature rejected before provider call' );
reset_fixture(); expect( 404 === call_verify( array( 'razorpay_order_id' => 'order_other123' ) )->status && 0 === $GLOBALS['get_calls'], 'wrong Razorpay order ID rejected' );
reset_fixture(); $GLOBALS['payment_provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_other123', 'amount' => 1250, 'currency' => 'INR', 'status' => 'captured', 'captured' => true ) ) ); expect( 409 === call_verify()->status && empty( $GLOBALS['meta'][10]['ch_razorpay_verified_payment_id'] ), 'provider payment attached to a different order is rejected' );
reset_fixture(); $GLOBALS['payment_provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_test123', 'amount' => 1251, 'currency' => 'INR', 'status' => 'captured' ) ) ); expect( 409 === call_verify()->status && empty( $GLOBALS['meta'][10]['ch_razorpay_verified_payment_id'] ), 'wrong payment amount is rejected' );
reset_fixture(); $GLOBALS['payment_provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_test123', 'amount' => 1250, 'currency' => 'USD', 'status' => 'captured' ) ) ); expect( 409 === call_verify()->status, 'wrong payment currency is rejected' );
reset_fixture( array( 'user_id' => 7 ) ); $GLOBALS['user_id'] = 8; expect( 404 === call_verify()->status && 0 === $GLOBALS['get_calls'], 'cross-customer verification rejected' );
reset_fixture( array( 'user_id' => 7 ) ); $GLOBALS['user_id'] = 7; expect( 200 === call_verify()->status, 'authenticated customer can verify their own order' );
reset_fixture(); expect( 404 === call_status( array( 'authorization_token' => '' ) )->status, 'order-status read rejects a missing capability' );
reset_fixture( array( 'user_id' => 7 ) ); $GLOBALS['user_id'] = 8; expect( 404 === call_status()->status, 'order-status capability cannot expose another authenticated customer order' );
reset_fixture( array( 'total' => '0.00', 'status' => 'complete', 'gateway' => 'manual' ) ); $GLOBALS['meta'][10]['ch_checkout_type'] = 'zero_total'; expect( true === call_status()->data['data']['free_completed'] && false === call_status()->data['data']['fulfilled'], 'status read keeps free completion distinct from captured payment fulfillment' );

function download_request( $params = array() ) { return new Request( array_merge( array( 'order_id' => 10, 'authorization_token' => str_repeat( 'a', 64 ) ), $params ) ); }
function completed_download_fixture( $order = array() ) { reset_fixture( array_merge( array( 'status' => 'complete' ), $order ) ); $GLOBALS['meta'][10]['ch_razorpay_order_id'] = 'order_test123'; $GLOBALS['meta'][10]['ch_razorpay_verified_payment_id'] = 'pay_test123'; $GLOBALS['meta'][10]['ch_razorpay_verified_payment_status'] = 'captured'; $GLOBALS['meta'][10]['ch_razorpay_verified_at'] = '2026-10-23T10:00:00+00:00'; $GLOBALS['meta'][10]['ch_razorpay_amount_paise'] = 1250; $GLOBALS['transients']['ch_pay_auth_10'] = str_repeat( 'a', 64 ); }
completed_download_fixture(); $downloads = ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request() ); expect( 200 === $downloads->status && 'Synthetic product' === $downloads->data['data']['items'][0]['title'] && 'Synthetic asset' === $downloads->data['data']['items'][0]['files'][0]['name'] && ! isset( $downloads->data['data']['items'][0]['files'][0]['url'] ), 'guest capability lists only purchased item file names without issuing URLs' );
completed_download_fixture( array( 'gateway' => '' ) ); expect( 200 === ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request() )->status, 'historical empty-gateway order with complete custom Razorpay verification evidence is authorized' );
completed_download_fixture( array( 'gateway' => 'ch_razorpay' ) ); expect( 200 === ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request() )->status, 'new custom Razorpay gateway order remains authorized' );
foreach ( array( 'ch_razorpay_order_id', 'ch_razorpay_verified_payment_id', 'ch_razorpay_verified_payment_status', 'ch_razorpay_verified_at', 'ch_razorpay_amount_paise' ) as $missing ) { completed_download_fixture( array( 'gateway' => '' ) ); unset( $GLOBALS['meta'][10][ $missing ] ); expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request() )->status, 'empty gateway is denied without ' . $missing ); }
completed_download_fixture( array( 'gateway' => '' ) ); $GLOBALS['meta'][10]['ch_razorpay_amount_paise'] = 1249; expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request() )->status, 'empty gateway with amount mismatch is denied' );
completed_download_fixture( array( 'gateway' => '', 'currency' => 'USD' ) ); expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request() )->status, 'empty gateway with currency mismatch is denied' );
completed_download_fixture(); expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request( array( 'authorization_token' => '' ) ) )->status, 'missing guest capability cannot list purchased downloads' );
completed_download_fixture(); expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request( array( 'authorization_token' => str_repeat( 'b', 64 ) ) ) )->status, 'invalid guest capability cannot list purchased downloads' );
completed_download_fixture( array( 'user_id' => 7 ) ); $GLOBALS['user_id'] = 8; expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request() )->status, 'another signed-in customer cannot list a guest capability order' );
reset_fixture( array( 'status' => 'complete' ) ); expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request() )->status, 'a completed paid order without captured verification is not downloadable' );
completed_download_fixture(); expect( 200 === ( new CH_Payment_Controller( new Auth() ) )->order_download_url( download_request( array( 'order_item_id' => 21, 'file_key' => 'main' ) ) )->status && $GLOBALS['download_url_args'][0]->id === 21 && 'synthetic@example.test' === $GLOBALS['download_url_args'][1] && 'main' === $GLOBALS['download_url_args'][2], 'valid authorized click mints an EDD native URL for the exact purchased file' );
completed_download_fixture(); expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->order_download_url( download_request( array( 'order_item_id' => 22, 'file_key' => 'main' ) ) )->status, 'order item belonging to another order is rejected' );
completed_download_fixture(); $GLOBALS['order_items'][21]->status = 'refunded'; expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->order_download_url( download_request( array( 'order_item_id' => 21, 'file_key' => 'main' ) ) )->status, 'refunded or otherwise non-deliverable line item cannot mint a file URL' );
completed_download_fixture(); expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->order_download_url( download_request( array( 'order_item_id' => 21, 'file_key' => 'other' ) ) )->status, 'file not entitled by purchased price option is rejected' );
completed_download_fixture(); $GLOBALS['meta'][10]['ch_razorpay_full_refund_verified'] = '1'; expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request() )->status, 'verified full refund revokes guest download listing' );
completed_download_fixture( array( 'status' => 'refunded' ) ); $GLOBALS['meta'][10]['ch_razorpay_full_refund_verified'] = '1'; expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->order_download_url( download_request( array( 'order_item_id' => 21, 'file_key' => 'main' ) ) )->status, 'EDD refunded order cannot mint another file URL' );
completed_download_fixture( array( 'gateway' => 'razorpay' ) ); expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request() )->status, 'legacy Razorpay orders cannot use custom guest capability downloads' );
reset_fixture( array( 'status' => 'complete', 'gateway' => 'manual', 'total' => '0.00' ) ); $GLOBALS['meta'][10]['ch_checkout_type'] = 'zero_total'; $GLOBALS['transients']['ch_pay_auth_10'] = str_repeat( 'a', 64 ); expect( 200 === ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request() )->status, 'completed zero-value order can use its existing order-scoped capability' );
completed_download_fixture(); unset( $GLOBALS['transients']['ch_pay_auth_10'] ); expect( 404 === ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request() )->status, 'expired server-side capability cannot list downloads even if a stale cookie is replayed' );
completed_download_fixture( array( 'status' => 'partially_refunded' ) ); expect( 200 === ( new CH_Payment_Controller( new Auth() ) )->order_downloads( download_request() )->status, 'partially refunded order retains only EDD-deliverable item downloads' );
reset_fixture( array( 'gateway' => '' ) ); expect( 404 === call_verify()->status && 0 === $GLOBALS['get_calls'] && 0 === count( $GLOBALS['transactions'] ) && empty( $GLOBALS['meta'][10]['ch_razorpay_verified_payment_id'] ), 'historical custom order without the new gateway is not modified by verification' );
foreach ( array( 'pending', 'failed' ) as $state ) { reset_fixture(); $GLOBALS['payment_provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_test123', 'amount' => 1250, 'currency' => 'INR', 'status' => $state ) ) ); expect( 409 === call_verify()->status && empty( $GLOBALS['meta'][10]['ch_razorpay_verified_payment_id'] ) && 0 === count( $GLOBALS['transactions'] ), $state . ' payment creates neither captured metadata nor native transaction' ); }
reset_fixture(); $GLOBALS['payment_provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_test123', 'amount' => 1250, 'currency' => 'INR', 'status' => 'authorized', 'captured' => false ) ) ); $authorized = call_verify(); expect( 200 === $authorized->status && 'authorized' === $authorized->data['data']['status'] && 'pending' === $GLOBALS['orders'][10]->status && 0 === count( $GLOBALS['transactions'] ), 'authorized payment is recorded as authorized but remains unfulfilled and has no captured transaction' );
$GLOBALS['payment_provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_test123', 'amount' => 1250, 'currency' => 'INR', 'status' => 'captured', 'captured' => true ) ) ); $captured_later = call_verify(); expect( 200 === $captured_later->status && 'captured' === $captured_later->data['data']['status'] && 'captured' === $GLOBALS['meta'][10]['ch_razorpay_verified_payment_status'] && 'pending' === $GLOBALS['orders'][10]->status && 1 === count( $GLOBALS['transactions'] ), 'authorized payment can later be verified as captured and recorded without fulfillment' );
reset_fixture(); $GLOBALS['transaction_fail'] = true; expect( 503 === call_verify()->status && 0 === count( $GLOBALS['transactions'] ), 'native transaction write failure returns retryable response' ); $GLOBALS['transaction_fail'] = false; expect( 200 === call_verify()->status && 1 === count( $GLOBALS['transactions'] ), 'retry records previously verified captured payment once' );
reset_fixture(); $GLOBALS['transactions'][] = (object) array( 'object_type' => 'order', 'object_id' => 99, 'transaction_id' => 'pay_test123', 'gateway' => 'razorpay', 'status' => 'complete', 'total' => 12.5 ); expect( 503 === call_verify()->status && 1 === count( $GLOBALS['transactions'] ) && 'pending' === $GLOBALS['orders'][10]->status, 'conflicting or legacy transaction is never reassigned to a custom order' );
reset_fixture(); $GLOBALS['payment_provider'] = new WP_Error( 'provider' ); expect( 503 === call_verify()->status && empty( $GLOBALS['meta'][10]['ch_razorpay_verified_payment_id'] ), 'provider API error does not record payment' );
reset_fixture(); $GLOBALS['payment_provider'] = array( 'code' => 502, 'body' => '{}' ); expect( 503 === call_verify()->status && empty( $GLOBALS['meta'][10]['ch_razorpay_verified_payment_id'] ), 'provider HTTP failure does not record payment' );
reset_fixture(); $GLOBALS['wpdb']->busy = true; expect( 503 === call_verify()->status && 0 === $GLOBALS['get_calls'], 'concurrent verification is stopped by the order lock' );
reset_fixture(); call_verify(); expect( 409 === call_verify( array( 'razorpay_payment_id' => 'pay_other123', 'razorpay_signature' => hash_hmac( 'sha256', 'order_test123|pay_other123', 'synthetic-secret-value' ) ) )->status, 'different payment cannot replace an already verified payment' );

putenv( 'CH_RAZORPAY_TEST_KEY_ID' ); putenv( 'CH_RAZORPAY_TEST_KEY_SECRET' );
echo "Razorpay payment controller tests passed.\n";
