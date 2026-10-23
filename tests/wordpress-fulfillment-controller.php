<?php
/** Synthetic EDD fulfillment tests; mocked provider and native EDD status API only. */
define( 'ABSPATH', __DIR__ );
define( 'CH_RAZORPAY_AUTO_FULFILL', true );
class WP_REST_Server { const CREATABLE = 'POST'; }
class WP_REST_Response { public $data; public $status; public function __construct( $data, $status = 200 ) { $this->data = $data; $this->status = $status; } public function header( $key, $value ) {} }
class WP_Error { public $code; public function __construct( $code ) { $this->code = $code; } }
class CH_API { const NAMESPACE = 'ch/v1'; public static function success( $data, $status = 200 ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data ), $status ); } public static function error( $code, $message, $status ) { return new WP_REST_Response( array( 'success' => false, 'error' => array( 'code' => $code ) ), $status ); } }
class Request { private $p; public function __construct( $p ) { $this->p = $p; } public function get_param( $key ) { return $this->p[ $key ] ?? null; } public function get_header( $key ) { return ''; } }
class WebhookRequest { private $body; private $headers; public function __construct( $body, $headers ) { $this->body = $body; $this->headers = $headers; } public function get_body() { return $this->body; } public function get_header( $key ) { return $this->headers[ strtolower( $key ) ] ?? ''; } }
class Auth { public function bridge_permission( $request ) { return true; } public function session_permission( $request ) { return true; } }
class Order { public $id = 10; public $type = 'sale'; public $status = 'pending'; public $user_id = 0; public $currency = 'INR'; public $total = '12.50'; public $gateway = 'ch_razorpay'; public $items; public function __construct() { $this->items = array( array( 'product_id' => 88, 'price_id' => 2, 'quantity' => 1, 'amount' => 12.50 ) ); } public function get_number() { return 'CH-10'; } }
class Db { public $busy = false; public $no_match = false; public $prefix = 'wp_'; public $locks = array(); public function prepare( $sql, ...$args ) { return array( $sql, $args ); } public function get_var( $query ) { if ( strpos( $query[0], 'GET_LOCK' ) !== false ) { $this->locks[] = $query[1][0]; return $this->busy ? '0' : '1'; } if ( strpos( $query[0], 'edd_ordermeta' ) !== false ) { return ! $this->no_match && 'order_test123' === $query[1][1] ? 10 : 0; } return '1'; } }
function register_rest_route( ...$args ) {}
function add_filter( ...$args ) {}
function rest_ensure_response( $response ) { return $response; }
function absint( $value ) { return abs( (int) $value ); }
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_key( $value ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) ); }
function get_current_user_id() { return $GLOBALS['current_user'] ?? 0; }
function edd_get_currency() { return 'INR'; }
function edd_get_order( $id ) { return $GLOBALS['orders'][ $id ] ?? false; }
function edd_get_order_meta( $id, $key, $single = true ) { return $GLOBALS['meta'][ $id ][ $key ] ?? ''; }
function edd_update_order_meta( $id, $key, $value ) { $GLOBALS['meta'][ $id ][ $key ] = $value; return true; }
function edd_get_order_transaction_by( $field, $value ) { foreach ( $GLOBALS['transactions'] as $transaction ) { if ( isset( $transaction->$field ) && (string) $transaction->$field === (string) $value ) { return $transaction; } } return false; }
function edd_add_order_transaction( $data ) { $transaction = (object) $data; $GLOBALS['transactions'][] = $transaction; return count( $GLOBALS['transactions'] ); }
function edd_update_order_status( $id, $status ) { $order = edd_get_order( $id ); if ( ! $order || $order->status === $status ) { return false; } $order->status = $status; $GLOBALS['status_calls']++; if ( 'complete' === $status ) { $GLOBALS['entitlements']++; } return true; }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function wp_remote_get( $url, $args ) { $GLOBALS['requests'][] = $url; return $GLOBALS['provider']; }
function wp_remote_retrieve_response_code( $response ) { return $response['code']; }
function wp_remote_retrieve_body( $response ) { return $response['body']; }
function maybe_serialize( $value ) { return is_array( $value ) || is_object( $value ) ? serialize( $value ) : (string) $value; }
require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-payment-controller.php';
$passed = 0; $failed = 0;
function check( $ok, $label ) { global $passed, $failed; if ( $ok ) { $passed++; } else { $failed++; fwrite( STDERR, "FAIL: {$label}\n" ); } }
function fixture( $status = 'captured', $order_status = 'pending', $user_id = 0 ) { putenv( 'CH_RAZORPAY_WEBHOOK_SECRET=synthetic-webhook-secret' ); putenv( 'CH_RAZORPAY_TEST_KEY_ID=rzp_test_synthetic' ); putenv( 'CH_RAZORPAY_TEST_KEY_SECRET=synthetic-api-secret' ); $GLOBALS['current_user'] = 0; $GLOBALS['wpdb'] = new Db(); $GLOBALS['transactions'] = array(); $o = new Order(); $o->status = $order_status; $o->user_id = $user_id; $GLOBALS['orders'] = array( 10 => $o ); $GLOBALS['meta'] = array( 10 => array( 'ch_payment_authorization_hash' => hash( 'sha256', str_repeat( 'a', 64 ) ), 'ch_razorpay_order_id' => 'order_test123', 'ch_razorpay_amount_paise' => 1250 ) ); $GLOBALS['status_calls'] = 0; $GLOBALS['entitlements'] = 0; $GLOBALS['requests'] = array(); $GLOBALS['provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_test123', 'amount' => 1250, 'currency' => 'INR', 'status' => $status, 'captured' => 'captured' === $status ) ) ); }
function verify( $changes = array() ) { $params = array_merge( array( 'order_id' => 10, 'authorization_token' => str_repeat( 'a', 64 ), 'razorpay_payment_id' => 'pay_test123', 'razorpay_order_id' => 'order_test123', 'razorpay_signature' => hash_hmac( 'sha256', 'order_test123|pay_test123', 'synthetic-api-secret' ) ), $changes ); return ( new CH_Payment_Controller( new Auth() ) )->verify_payment( new Request( $params ) ); }
function webhook( $event_id = 'evt_1', $event_type = 'payment.captured', $razorpay_order_id = 'order_test123' ) { $body = json_encode( array( 'id' => $event_id, 'event' => $event_type, 'payload' => array( 'payment' => array( 'entity' => array( 'id' => 'pay_test123', 'order_id' => $razorpay_order_id ) ) ) ) ); return ( new CH_Payment_Controller( new Auth() ) )->receive_webhook( new WebhookRequest( $body, array( 'x-razorpay-signature' => hash_hmac( 'sha256', $body, 'synthetic-webhook-secret' ) ) ) ); }

fixture(); $r = verify(); check( 200 === $r->status && true === $r->data['data']['fulfilled'] && 'complete' === $GLOBALS['orders'][10]->status, 'captured payment completes eligible pending order' ); check( 1 === $GLOBALS['status_calls'] && 1 === $GLOBALS['entitlements'], 'native EDD status API triggers permissions exactly once' ); check( 0 === $GLOBALS['orders'][10]->user_id && 88 === $GLOBALS['orders'][10]->items[0]['product_id'] && 2 === $GLOBALS['orders'][10]->items[0]['price_id'], 'guest ownership and purchased line item remain intact' );
check( true === verify()->data['data']['fulfilled'] && 1 === $GLOBALS['status_calls'] && 1 === $GLOBALS['entitlements'], 'duplicate browser verification does not repeat completion' );
fixture(); $GLOBALS['provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_test123', 'amount' => 1251, 'currency' => 'INR', 'status' => 'captured', 'captured' => true ) ) ); check( 409 === verify()->status && 0 === $GLOBALS['status_calls'], 'wrong amount is rejected' );
fixture(); $GLOBALS['provider'] = array( 'code' => 200, 'body' => json_encode( array( 'id' => 'pay_test123', 'order_id' => 'order_test123', 'amount' => 1250, 'currency' => 'USD', 'status' => 'captured', 'captured' => true ) ) ); check( 409 === verify()->status && 0 === $GLOBALS['status_calls'], 'wrong currency is rejected' );
fixture(); check( 404 === verify( array( 'razorpay_order_id' => 'order_other123' ) )->status && 0 === $GLOBALS['status_calls'], 'wrong Razorpay order ID is rejected' );
fixture( 'failed' ); check( 409 === verify()->status && 'pending' === $GLOBALS['orders'][10]->status && 0 === $GLOBALS['entitlements'], 'failed payment remains pending' );
fixture( 'authorized' ); $r = verify(); check( 200 === $r->status && false === $r->data['data']['fulfilled'] && 'pending' === $GLOBALS['orders'][10]->status, 'authorized-only payment remains pending' );
fixture(); $r = webhook(); check( 200 === $r->status && true === $r->data['data']['fulfilled'] && 1 === $GLOBALS['entitlements'], 'captured webhook fulfills through native EDD API' ); check( true === webhook( 'evt_2' )->data['data']['duplicate'] && 1 === $GLOBALS['status_calls'], 'webhook after browser retry does not repeat fulfillment' );
fixture(); verify(); check( true === webhook()->data['data']['duplicate'] && 1 === $GLOBALS['status_calls'], 'webhook/browser race serializes on shared order lock' ); check( 'ch_rzpv_10' === $GLOBALS['wpdb']->locks[0], 'fulfillment uses shared per-order lock namespace' );
fixture( 'captured', 'complete' ); $r = verify(); check( 200 === $r->status && 0 === $GLOBALS['status_calls'] && 0 === $GLOBALS['entitlements'], 'existing completed orders are not modified' );
fixture(); $GLOBALS['wpdb']->busy = true; check( 503 === verify()->status && 0 === $GLOBALS['status_calls'], 'concurrent request returns retryable busy response' );
fixture(); $GLOBALS['wpdb']->no_match = true; $legacy = webhook( 'evt_legacy', 'payment.captured', 'order_legacy123' ); check( 200 === $legacy->status && 0 === count( $GLOBALS['requests'] ), 'legacy or unknown Razorpay orders are ignored' );
fixture( 'failed' ); check( 200 === webhook( 'evt_fail', 'payment.failed' )->status && 0 === $GLOBALS['entitlements'], 'failed webhook cannot grant entitlements' );
fixture(); check( 400 === verify( array( 'razorpay_signature' => str_repeat( '0', 64 ) ) )->status && 0 === $GLOBALS['status_calls'], 'unverified payment cannot fulfill' );
fixture( 'captured', 'pending', 7 ); $GLOBALS['current_user'] = 8; check( 404 === verify()->status && 0 === $GLOBALS['status_calls'], 'authenticated customer cannot verify another customer order' );
fixture( 'captured', 'pending', 7 ); $GLOBALS['current_user'] = 7; check( 200 === verify()->status && 1 === $GLOBALS['entitlements'] && 7 === $GLOBALS['orders'][10]->user_id, 'authenticated customer can verify own order without changing ownership' );
fixture(); $GLOBALS['orders'][10]->status = 'abandoned'; check( 409 === verify()->status && 0 === $GLOBALS['status_calls'], 'abandoned order is ineligible for payment verification' );
fixture(); verify(); verify(); webhook( 'evt_dup' ); webhook( 'evt_dup' ); check( 1 === $GLOBALS['status_calls'] && 1 === $GLOBALS['entitlements'], 'duplicate browser callbacks and webhook IDs produce one completion' );
fixture(); verify(); $status = $GLOBALS['orders'][10]->status; $entitlements = $GLOBALS['entitlements']; check( 'complete' === $status && 1 === $entitlements, 'entitlements stay withheld until native EDD completion runs' );
fixture(); $GLOBALS['meta'][10]['ch_razorpay_refunded_amount_paise'] = 300; $partial_refund_retry = verify(); check( 200 === $partial_refund_retry->status && false === $partial_refund_retry->data['data']['fulfilled'] && 'pending' === $GLOBALS['orders'][10]->status && 0 === $GLOBALS['status_calls'], 'partially refunded captured order cannot be fulfilled on retry' ); check( ! method_exists( new CH_Payment_Controller( new Auth() ), 'refund_payment' ), 'refund initiation is not exposed through the API' );
fixture(); $GLOBALS['meta'][10]['ch_razorpay_full_refund_verified'] = '1'; $verified_full_refund = verify(); check( 200 === $verified_full_refund->status && false === $verified_full_refund->data['data']['fulfilled'] && 0 === $GLOBALS['status_calls'], 'verified full refund cannot be fulfilled while EDD item revocation is retrying' );
putenv( 'CH_RAZORPAY_TEST_KEY_ID' ); putenv( 'CH_RAZORPAY_TEST_KEY_SECRET' ); putenv( 'CH_RAZORPAY_WEBHOOK_SECRET' );
echo "Fulfillment tests: {$passed} passed, {$failed} failed.\n";
exit( $failed ? 1 : 0 );
