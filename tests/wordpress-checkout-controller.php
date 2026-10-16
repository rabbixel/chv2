<?php
/** Synthetic checkout tests. This file never connects to WordPress or a database. */
namespace {
	define( 'ABSPATH', __DIR__ );
	define( 'DAY_IN_SECONDS', 86400 );
	class WP_REST_Server { const CREATABLE = 'POST'; }
	class WP_Error { public $code; public function __construct( $code ) { $this->code = $code; } }
	class WP_REST_Response { public $data; public $status; public $headers = array(); public function __construct( $data, $status = 200 ) { $this->data = $data; $this->status = $status; } public function get_status() { return $this->status; } public function get_data() { return $this->data; } public function header( $key, $value ) { $this->headers[ $key ] = $value; } }
	class CH_API { const NAMESPACE = 'ch/v1'; public static function success( $data, $status = 200 ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data ), $status ); } public static function error( $code, $message, $status ) { return new WP_REST_Response( array( 'success' => false, 'error' => array( 'code' => $code, 'message' => $message ) ), $status ); } }
	class FakeRequest { private $params; private $headers; public function __construct( $params, $headers = array() ) { $this->params = $params; $this->headers = array_change_key_case( $headers, CASE_LOWER ); } public function get_param( $key ) { return $this->params[ $key ] ?? null; } public function get_header( $key ) { return $this->headers[ strtolower( $key ) ] ?? ''; } }
	class FakeAuth { public function bridge_permission( $request ) { return $GLOBALS['bridge_ok'] ? true : new WP_Error( 'bridge' ); } public function session_permission( $request ) { return $GLOBALS['session_ok'] ? true : new WP_Error( 'session' ); } }
	class FakeCart { public function validate( $request ) { if ( $GLOBALS['cart_unavailable'] ) { return new WP_REST_Response( array( 'success' => false ), 422 ); } return new WP_REST_Response( array( 'success' => true, 'data' => array( 'items' => $GLOBALS['cart_items'] ) ) ); } }
	class FakeCustomer { public $id; public $user_id; public function __construct( $id, $user_id = 0 ) { $this->id = $id; $this->user_id = $user_id; } public function attach_payment( $id, $update = false ) { $GLOBALS['customer_orders'][] = array( $this->id, $id, $update ); return true; } }
	class FakeOrder { public $id; public $status = 'pending'; public $total; public $currency = 'INR'; public function __construct( $id, $total ) { $this->id = $id; $this->total = $total; } public function get_number() { return 'T' . $this->id; } }
	class FakeWpdb { public function prepare( $query, ...$args ) { return array( $query, $args ); } public function get_var( $prepared ) { return false !== strpos( $prepared[0], 'GET_LOCK' ) ? '1' : '1'; } public function query( $sql ) { $GLOBALS['transactions'][] = $sql; return false === strpos( $sql, 'FAIL' ); } }
	$GLOBALS['wpdb'] = new FakeWpdb();
	function register_rest_route( $ns, $route, $args ) { $GLOBALS['routes'][ $route ] = $args; }
	function rest_ensure_response( $response ) { return $response; }
	function absint( $value ) { return abs( (int) $value ); }
	function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
	function sanitize_email( $value ) { return filter_var( (string) $value, FILTER_SANITIZE_EMAIL ); }
	function is_email( $value ) { return (bool) filter_var( $value, FILTER_VALIDATE_EMAIL ); }
	function wp_salt( $scheme = '' ) { return 'synthetic-test-salt'; }
	function get_current_user_id() { return $GLOBALS['current_user']; }
	function get_userdata( $id ) { return (object) array( 'ID' => $id, 'user_email' => 'member@example.test' ); }
	function get_user_meta( $id, $key, $single ) { return 'Member'; }
	function edd_add_order( $data ) { $GLOBALS['created_order_data'][] = $data; $id = ++$GLOBALS['order_id']; $GLOBALS['orders'][ $id ] = new FakeOrder( $id, $data['total'] ); return $id; }
	function edd_add_order_item( $data ) { $GLOBALS['order_items'][] = $data; return count( $GLOBALS['order_items'] ); }
	function edd_add_order_address( $data ) { $GLOBALS['addresses'][] = $data; return count( $GLOBALS['addresses'] ); }
	function edd_add_order_adjustment( $data ) { $GLOBALS['adjustments'][] = $data; return count( $GLOBALS['adjustments'] ); }
	function edd_get_order( $id ) { return $GLOBALS['orders'][ $id ] ?? false; }
	function edd_get_customer_by( $field, $value ) { $GLOBALS['customer_lookup_fields'][] = $field; return 'user_id' === $field && 42 === (int) $value ? new FakeCustomer( 900, 42 ) : false; }
	function edd_add_customer( $data ) { $GLOBALS['created_customers'][] = $data; return 901 + count( $GLOBALS['created_customers'] ); }
	function edd_get_customer( $id ) { return new FakeCustomer( $id ); }
	function edd_get_currency() { return 'INR'; }
	function edd_generate_order_payment_key( $email ) { return 'synthetic-key'; }
	function edd_set_order_number() { return ''; }
	function edd_get_download_name( $id, $price_id = null ) { return 'Product ' . $id; }
	function edd_is_test_mode() { return true; }
	function edd_use_taxes() { return false; }
	function edd_get_discount_by_code( $code ) { return 'SAVE' === $code ? (object) array( 'id' => 1 ) : false; }
	function edd_is_discount_valid( $code, $user, $return_errors = false ) { return 'SAVE' === $code; }
	function edd_get_item_discount_amount( $item, $cart, $discounts, $price ) { return $price * (int) $item['quantity'] * 0.1; }
	function get_transient( $key ) { return $GLOBALS['transients'][ $key ] ?? false; }
	function set_transient( $key, $value, $ttl ) { $GLOBALS['transients'][ $key ] = $value; return true; }
	function delete_transient( $key ) { unset( $GLOBALS['transients'][ $key ] ); return true; }
	require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-checkout-controller.php';
	function check( $ok, $message ) { if ( ! $ok ) { fwrite( STDERR, "FAIL: $message\n" ); exit( 1 ); } }
	function request_for( $items, $headers = array(), $billing = array(), $discount = '' ) { return new FakeRequest( array( 'items' => $items, 'billing' => $billing, 'discount_code' => $discount ), $headers ); }
	$GLOBALS['bridge_ok'] = true; $GLOBALS['session_ok'] = true; $GLOBALS['current_user'] = 0; $GLOBALS['order_id'] = 1000;
	$GLOBALS['orders'] = array(); $GLOBALS['order_items'] = array(); $GLOBALS['addresses'] = array(); $GLOBALS['adjustments'] = array(); $GLOBALS['created_order_data'] = array(); $GLOBALS['created_customers'] = array();
	$GLOBALS['customer_orders'] = array(); $GLOBALS['customer_lookup_fields'] = array(); $GLOBALS['transactions'] = array(); $GLOBALS['transients'] = array(); $GLOBALS['cart_unavailable'] = false;
	$GLOBALS['cart_items'] = array( array( 'product_id' => 8, 'price_id' => null, 'quantity' => 1, 'unit_price' => 1250, 'available' => true ), array( 'product_id' => 20, 'price_id' => 2, 'quantity' => 2, 'unit_price' => 2500, 'available' => true ) );
	$controller = new \CH_Checkout_Controller( new FakeAuth(), new FakeCart() );
	$headers = array( 'Idempotency-Key' => '01234567-89ab-cdef-0123-456789abcdef' );
	$billing = array( 'full_name' => 'Guest Buyer', 'email' => 'guest@example.test', 'country' => 'IN', 'region' => 'KA' );
	$guest = request_for( array( array( 'product_id' => 8, 'price_id' => null, 'quantity' => 1, 'unit_price' => 1 ) ), $headers, $billing, 'SAVE' );
	$quote = $controller->quote( $guest );
	check( 200 === $quote->status && 6250 === $quote->data['data']['subtotal']['amount'], 'quote uses server validated cart prices' );
	check( 625 === $quote->data['data']['discount']['amount'], 'EDD discount calculation is applied' );
	check( false !== strpos( $quote->headers['Cache-Control'], 'no-store' ), 'quote is private and non-cacheable' );
	$prepared = $controller->prepare( $guest );
	check( 201 === $prepared->status && 'pending' === $prepared->data['data']['status'], 'guest order is created pending' );
	check( 1 === count( $GLOBALS['created_customers'] ) && 0 === $GLOBALS['created_customers'][0]['user_id'], 'guest gets separate unlinked customer without email lookup' );
	check( 'pending' === $GLOBALS['created_order_data'][0]['status'] && '' === $GLOBALS['created_order_data'][0]['gateway'], 'order has no payment gateway and remains pending' );
	check( 1 === count( $GLOBALS['adjustments'] ) && 'discount' === $GLOBALS['adjustments'][0]['type'] && 1001 === $GLOBALS['adjustments'][0]['object_id'], 'discount is represented in EDD order adjustments' );
	check( 2 === count( $GLOBALS['order_items'] ) && 20 === $GLOBALS['order_items'][1]['product_id'] && 2 === $GLOBALS['order_items'][1]['price_id'], 'items preserve product and variable-price relationships' );
	check( 'pending' === $GLOBALS['order_items'][1]['status'] && 1001 === $GLOBALS['order_items'][1]['order_id'], 'order items are pending and point to the EDD order' );
	check( array( 902, 1001, false ) === $GLOBALS['customer_orders'][0], 'EDD customer is attached to the new order' );
	$again = $controller->prepare( $guest );
	check( 200 === $again->status && false === $again->data['data']['created'] && 1 === count( $GLOBALS['created_order_data'] ), 'repeated idempotent submit reuses pending order' );
	$GLOBALS['current_user'] = 42;
	$member_request = request_for( array(), array( 'Authorization' => 'Bearer valid', 'Idempotency-Key' => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' ), array( 'full_name' => 'Member Name', 'email' => 'ignored@example.test', 'country' => 'IN' ) );
	$member = $controller->prepare( $member_request );
	check( 201 === $member->status && 42 === $GLOBALS['created_order_data'][1]['user_id'] && 900 === $GLOBALS['created_order_data'][1]['customer_id'], 'logged-in checkout resolves customer by WordPress user ID' );
	check( 'member@example.test' === $GLOBALS['created_order_data'][1]['email'], 'logged-in billing email comes from authenticated WordPress identity' );
	check( ! in_array( 'email', $GLOBALS['customer_lookup_fields'], true ), 'customer is never linked by email matching' );
	$GLOBALS['session_ok'] = false;
	check( $controller->bridge_permission( $member_request ) instanceof WP_Error, 'expired customer session is rejected by bridge permission' );
	$GLOBALS['session_ok'] = true;
	$bad_billing = request_for( array(), $headers, array( 'full_name' => 'x', 'email' => 'bad' ) );
	check( 422 === $controller->prepare( $bad_billing )->status, 'invalid billing is rejected' );
	$GLOBALS['cart_unavailable'] = true;
	check( 422 === $controller->prepare( $guest )->status, 'unavailable cart item is rejected' );
	$GLOBALS['cart_unavailable'] = false;
	$GLOBALS['cart_items'] = array( array( 'product_id' => 7, 'price_id' => null, 'quantity' => 1, 'unit_price' => 0, 'available' => true ) );
	$before = count( $GLOBALS['created_order_data'] );
	check( 422 === $controller->prepare( $guest )->status && $before === count( $GLOBALS['created_order_data'] ), 'zero-total order is explicitly rejected without creating an order' );
	$GLOBALS['cart_items'] = array( array( 'product_id' => 8, 'price_id' => null, 'quantity' => 1, 'unit_price' => 1250, 'available' => true ) );
	$no_key = request_for( array(), array(), $billing );
	check( 400 === $controller->prepare( $no_key )->status, 'missing idempotency key is rejected' );
	check( count( $GLOBALS['addresses'] ) === count( $GLOBALS['created_order_data'] ), 'billing address saved for each prepared order' );
	check( ! isset( $GLOBALS['download_permissions'] ) && ! isset( $GLOBALS['license_keys'] ) && ! isset( $GLOBALS['receipts'] ), 'pending flow does not grant entitlements or issue receipts/licenses' );
	echo "Checkout controller synthetic tests passed.\n";
}
