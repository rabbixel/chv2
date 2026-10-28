<?php
/** Synthetic checkout tests. This file never connects to WordPress or a database. */
namespace {
	define( 'ABSPATH', __DIR__ );
	define( 'DAY_IN_SECONDS', 86400 );
	define( 'HOUR_IN_SECONDS', 3600 );
	define( 'MINUTE_IN_SECONDS', 60 );
	class WP_REST_Server { const CREATABLE = 'POST'; }
	class WP_Error { public $code; public function __construct( $code ) { $this->code = $code; } }
	class WP_REST_Response { public $data; public $status; public $headers = array(); public function __construct( $data, $status = 200 ) { $this->data = $data; $this->status = $status; } public function get_status() { return $this->status; } public function get_data() { return $this->data; } public function header( $key, $value ) { $this->headers[ $key ] = $value; } }
	class CH_API { const NAMESPACE = 'ch/v1'; public static function success( $data, $status = 200 ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data ), $status ); } public static function error( $code, $message, $status ) { return new WP_REST_Response( array( 'success' => false, 'error' => array( 'code' => $code, 'message' => $message ) ), $status ); } }
	class FakeRequest { private $params; private $headers; public function __construct( $params, $headers = array() ) { $this->params = $params; $this->headers = array_change_key_case( $headers, CASE_LOWER ); } public function get_param( $key ) { return $this->params[ $key ] ?? null; } public function get_header( $key ) { return $this->headers[ strtolower( $key ) ] ?? ''; } }
	class FakeAuth { public function bridge_permission( $request ) { return $GLOBALS['bridge_ok'] ? true : new WP_Error( 'bridge' ); } public function session_permission( $request ) { return $GLOBALS['session_ok'] ? true : new WP_Error( 'session' ); } }
	class FakeCart { public function validate( $request ) { if ( $GLOBALS['cart_unavailable'] ) { return new WP_REST_Response( array( 'success' => false ), 422 ); } return new WP_REST_Response( array( 'success' => true, 'data' => array( 'items' => $GLOBALS['cart_items'] ) ) ); } }
	class FakeCustomer { public $id; public $user_id; public function __construct( $id, $user_id = 0 ) { $this->id = $id; $this->user_id = $user_id; } public function attach_payment( $id, $update = false ) { $GLOBALS['customer_orders'][] = array( $this->id, $id, $update ); return true; } }
	class FakeOrder { public $id; public $type = 'sale'; public $status = 'pending'; public $total; public $currency = 'INR'; public $gateway; public $user_id; public function __construct( $id, $data ) { $this->id = $id; $this->total = $data['total']; $this->gateway = $data['gateway']; $this->user_id = $data['user_id']; } public function get_number() { return 'T' . $this->id; } }
	class FakeWpdb { public $prefix = 'wp_'; public function prepare( $query, ...$args ) { return array( $query, $args ); } public function get_var( $prepared ) { if ( false !== strpos( $prepared[0], 'GET_LOCK' ) ) { return '1'; } if ( false !== strpos( $prepared[0], 'COALESCE(SUM' ) ) { return $GLOBALS['reserved_qty'] ?? 0; } return '1'; } public function query( $sql ) { $GLOBALS['transactions'][] = $sql; return false === strpos( $sql, 'FAIL' ); } }
	$GLOBALS['wpdb'] = new FakeWpdb();
	function register_rest_route( $ns, $route, $args ) { $GLOBALS['routes'][ $route ] = $args; }
	function rest_ensure_response( $response ) { return $response; }
	function absint( $value ) { return abs( (int) $value ); }
	function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
	function sanitize_email( $value ) { return filter_var( (string) $value, FILTER_SANITIZE_EMAIL ); }
	function is_email( $value ) { return (bool) filter_var( $value, FILTER_VALIDATE_EMAIL ); }
	function wp_salt( $scheme = '' ) { return 'synthetic-test-salt'; }
	function apply_filters( $tag, $value ) { return $GLOBALS['rate_filter_overrides'][ $tag ] ?? $value; }
	function wp_json_encode( $value ) { return json_encode( $value ); }
	function get_current_user_id() { return $GLOBALS['current_user']; }
	function is_wp_error( $value ) { return $value instanceof WP_Error; }
	function get_userdata( $id ) { return (object) array( 'ID' => $id, 'user_email' => 'member@example.test' ); }
	function get_user_meta( $id, $key, $single ) { return 'Member'; }
	function edd_add_order( $data ) { $GLOBALS['created_order_data'][] = $data; $id = ++$GLOBALS['order_id']; $GLOBALS['orders'][ $id ] = new FakeOrder( $id, $data ); return $id; }
	function edd_add_order_item( $data ) { $GLOBALS['order_items'][] = $data; if ( ! empty( $GLOBALS['product_limits'][ $data['product_id'] ] ) ) { $GLOBALS['reserved_qty'] += (int) $data['quantity']; } return count( $GLOBALS['order_items'] ); }
	function edd_add_order_address( $data ) { $GLOBALS['addresses'][] = $data; return count( $GLOBALS['addresses'] ); }
	function edd_add_order_adjustment( $data ) { $GLOBALS['adjustments'][] = $data; return count( $GLOBALS['adjustments'] ); }
	function edd_get_order( $id ) { return $GLOBALS['orders'][ $id ] ?? false; }
	function edd_update_order_meta( $id, $key, $value ) { $GLOBALS['order_meta'][ $id ][ $key ] = $value; return true; }
	function edd_get_order_meta( $id, $key, $single = true ) { return $GLOBALS['order_meta'][ $id ][ $key ] ?? ''; }
	function edd_update_customer_meta( $id, $key, $value ) { $GLOBALS['customer_meta'][ $id ][ $key ] = $value; return true; }
	function edd_update_payment_status( $id, $status ) { $order = $GLOBALS['orders'][ $id ] ?? false; if ( ! $order || $order->status === $status ) { return false; } $order->status = $status; if ( 'complete' === $status ) { foreach ( $GLOBALS['adjustments'] as $adjustment ) { if ( (int) $adjustment['object_id'] === (int) $id && 'discount' === $adjustment['type'] ) { $GLOBALS['coupon_used'] = true; } } } $GLOBALS['completions']++; return true; }
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
	function edd_is_discount_valid( $code, $user, $return_errors = false ) { return 'SAVE' === $code && empty( $GLOBALS['coupon_used'] ); }
	function edd_get_item_discount_amount( $item, $cart, $discounts, $price ) { return $price * (int) $item['quantity'] * ( $GLOBALS['coupon_percentage'] ?? 10 ) / 100; }
	function get_transient( $key ) { return $GLOBALS['transients'][ $key ] ?? false; }
	function get_post_meta( $id, $key, $single = true ) { if ( '_edd_purchase_limit' === $key ) { return $GLOBALS['product_limits'][ $id ] ?? ''; } if ( '_edd_download_sales' === $key ) { return (string) ( $GLOBALS['product_sales'][ $id ] ?? 0 ); } return ''; }
	function edd_get_download_sales_stats( $id ) { return $GLOBALS['product_sales'][ $id ] ?? 0; }
	function edd_get_gross_order_statuses() { return array( 'complete', 'refunded', 'partially_refunded', 'revoked', 'on_hold' ); }
	require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-purchase-limit-service.php';
	function set_transient( $key, $value, $ttl ) { $GLOBALS['transients'][ $key ] = $value; return true; }
	function delete_transient( $key ) { unset( $GLOBALS['transients'][ $key ] ); return true; }
	require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-checkout-controller.php';
	function check( $ok, $message ) { if ( ! $ok ) { fwrite( STDERR, "FAIL: $message\n" ); exit( 1 ); } }
	function checkout_rate_token( $nonce ) { return $nonce . '.' . hash_hmac( 'sha256', 'ch-checkout-rate-v1:' . $nonce, getenv( 'CH_AUTH_BRIDGE_SECRET' ) ); }
	function request_for( $items, $headers = array(), $billing = array(), $discount = '' ) { if ( ! isset( $headers['X-CH-Checkout-Rate-Token'] ) ) { $headers['X-CH-Checkout-Rate-Token'] = checkout_rate_token( str_repeat( 'a', 64 ) ); } return new FakeRequest( array( 'items' => $items, 'billing' => $billing, 'discount_code' => $discount ), $headers ); }
	putenv( 'CH_AUTH_BRIDGE_SECRET=' . str_repeat( 's', 40 ) );
	$GLOBALS['rate_filter_overrides'] = array( 'ch_checkout_quote_rate_limit' => 1000, 'ch_checkout_prepare_rate_limit' => 1000 );
	$GLOBALS['bridge_ok'] = true; $GLOBALS['session_ok'] = true; $GLOBALS['current_user'] = 0; $GLOBALS['order_id'] = 1000;
	$GLOBALS['orders'] = array(); $GLOBALS['order_items'] = array(); $GLOBALS['addresses'] = array(); $GLOBALS['adjustments'] = array(); $GLOBALS['created_order_data'] = array(); $GLOBALS['created_customers'] = array();
	$GLOBALS['customer_orders'] = array(); $GLOBALS['customer_lookup_fields'] = array(); $GLOBALS['transactions'] = array(); $GLOBALS['transients'] = array(); $GLOBALS['cart_unavailable'] = false; $GLOBALS['order_meta'] = array(); $GLOBALS['completions'] = 0; $GLOBALS['coupon_used'] = false; $GLOBALS['coupon_percentage'] = 10; $GLOBALS['product_limits'] = array(); $GLOBALS['product_sales'] = array(); $GLOBALS['reserved_qty'] = 0;
	$GLOBALS['cart_items'] = array( array( 'product_id' => 8, 'price_id' => null, 'quantity' => 1, 'unit_price' => 1250, 'available' => true ), array( 'product_id' => 20, 'price_id' => 2, 'quantity' => 2, 'unit_price' => 2500, 'available' => true ) );
	$controller = new \CH_Checkout_Controller( new FakeAuth(), new FakeCart() );
	$controller->register_routes();
	$GLOBALS['bridge_ok'] = false;
	foreach ( array( 'http://localhost:3000', 'https://attacker.example', '' ) as $origin ) {
		$browser_request = new FakeRequest( array(), array( 'Origin' => $origin ) );
		check( $GLOBALS['routes']['/checkout/quote']['permission_callback']( $browser_request ) instanceof WP_Error, 'checkout REST rejects browser-origin requests without the trusted bridge' );
	}
	$GLOBALS['bridge_ok'] = true;
	check( true === $GLOBALS['routes']['/checkout/quote']['permission_callback']( new FakeRequest( array(), array() ) ), 'legitimate originless server-to-server guest request passes the bridge' );
	$GLOBALS['session_ok'] = false;
	check( $GLOBALS['routes']['/checkout/prepare']['permission_callback']( new FakeRequest( array(), array( 'Authorization' => 'Bearer expired', 'Origin' => 'http://localhost:3000' ) ) ) instanceof WP_Error, 'expired authenticated checkout session is rejected despite a same-origin header' );
	$GLOBALS['session_ok'] = true;
	$headers = array( 'Idempotency-Key' => '01234567-89ab-cdef-0123-456789abcdef' );
	// This address is also used by a synthetic WordPress account below. Guest
	// checkout must remain unlinked and must not look up customers by email.
	$billing = array( 'full_name' => 'Guest Buyer', 'email' => 'member@example.test', 'phone' => '+91 98765 43210', 'country' => 'IN', 'region' => 'KA' );
	$guest = request_for( array( array( 'product_id' => 8, 'price_id' => null, 'quantity' => 1, 'unit_price' => 1 ) ), $headers, $billing, 'SAVE' );
	$quote = $controller->quote( $guest );
	check( 200 === $quote->status && 6250 === $quote->data['data']['subtotal']['amount'], 'quote uses server validated cart prices' );
	check( 625 === $quote->data['data']['discount']['amount'], 'EDD discount calculation is applied' );
	check( false !== strpos( $quote->headers['Cache-Control'], 'no-store' ), 'quote is private and non-cacheable' );
	$prepared = $controller->prepare( $guest );
	check( 201 === $prepared->status && 'pending' === $prepared->data['data']['status'], 'guest order is created pending' );
	$payment_token = $prepared->data['data']['payment_authorization_token'] ?? '';
	check( preg_match( '/^[a-f0-9]{64}$/D', $payment_token ) && hash( 'sha256', $payment_token ) === $GLOBALS['order_meta'][1001]['ch_payment_authorization_hash'], 'new paid checkout gets an order-scoped payment capability' );
	check( 1 === count( $GLOBALS['created_customers'] ) && 0 === $GLOBALS['created_customers'][0]['user_id'] && 'member@example.test' === $GLOBALS['created_customers'][0]['email'], 'guest using an account email gets a separate unlinked customer without email lookup' );
	check( 'pending' === $GLOBALS['created_order_data'][0]['status'] && 'ch_razorpay' === $GLOBALS['created_order_data'][0]['gateway'], 'paid custom order uses its isolated EDD gateway identifier and remains pending' );
	check( '+919876543210' === $GLOBALS['order_meta'][1001]['_edd_phone'] && '+919876543210' === $GLOBALS['customer_meta'][902]['phone'], 'validated E.164 phone is saved to EDD order and customer metadata' );
	check( 1 === count( $GLOBALS['adjustments'] ) && 'discount' === $GLOBALS['adjustments'][0]['type'] && 1001 === $GLOBALS['adjustments'][0]['object_id'], 'discount is represented in EDD order adjustments' );
	check( 2 === count( $GLOBALS['order_items'] ) && 20 === $GLOBALS['order_items'][1]['product_id'] && 2 === $GLOBALS['order_items'][1]['price_id'], 'items preserve product and variable-price relationships' );
	check( 'pending' === $GLOBALS['order_items'][1]['status'] && 1001 === $GLOBALS['order_items'][1]['order_id'], 'order items are pending and point to the EDD order' );
	check( array( 902, 1001, false ) === $GLOBALS['customer_orders'][0], 'EDD customer is attached to the new order' );
	$again = $controller->prepare( $guest );
	check( 200 === $again->status && false === $again->data['data']['created'] && 1 === count( $GLOBALS['created_order_data'] ), 'repeated idempotent submit reuses pending order' );
	check( $payment_token === $again->data['data']['payment_authorization_token'], 'idempotent checkout retry reuses the same payment capability' );
	$mismatch = request_for( array(), $headers, array_merge( $billing, array( 'phone' => '+447911123456' ) ), 'SAVE' );
	check( 409 === $controller->prepare( $mismatch )->status && 1 === count( $GLOBALS['created_order_data'] ), 'same idempotency key rejects changed phone number' );
	$transient_key = array_values( array_filter( array_keys( $GLOBALS['transients'] ), static function ( $key ) { return 0 === strpos( $key, 'ch_checkout_' ); } ) )[0];
	$GLOBALS['transients'][ $transient_key ] = 1001;
	check( 409 === $controller->prepare( $guest )->status && 1 === count( $GLOBALS['created_order_data'] ), 'legacy idempotency record without payload digest fails closed' );
	$GLOBALS['current_user'] = 42;
	$member_request = request_for( array(), array( 'Authorization' => 'Bearer valid', 'Idempotency-Key' => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' ), array( 'full_name' => 'Member Name', 'email' => 'ignored@example.test', 'phone' => '+14155552671', 'country' => 'IN' ) );
	$member = $controller->prepare( $member_request );
	check( 201 === $member->status && 42 === $GLOBALS['created_order_data'][1]['user_id'] && 900 === $GLOBALS['created_order_data'][1]['customer_id'], 'logged-in checkout resolves customer by WordPress user ID' );
	check( 'member@example.test' === $GLOBALS['created_order_data'][1]['email'], 'logged-in billing email comes from authenticated WordPress identity' );
	check( ! in_array( 'email', $GLOBALS['customer_lookup_fields'], true ), 'customer is never linked by email matching' );
	$GLOBALS['session_ok'] = false;
	check( $controller->bridge_permission( $member_request ) instanceof WP_Error, 'expired customer session is rejected by bridge permission' );
	$GLOBALS['session_ok'] = true;
	$GLOBALS['current_user'] = 0;
	$bad_billing = request_for( array(), $headers, array( 'full_name' => 'Guest Buyer', 'email' => 'guest@example.test', 'phone' => '+91 12345', 'country' => 'IN' ) );
	check( 422 === $controller->prepare( $bad_billing )->status, 'invalid billing is rejected' );
	$missing_phone = request_for( array(), array( 'Idempotency-Key' => 'eeeeeeee-ffff-0000-1111-222222222222' ), array( 'full_name' => 'Guest Buyer', 'email' => 'guest@example.test', 'country' => 'IN' ) );
	check( 422 === $controller->prepare( $missing_phone )->status, 'missing phone is rejected server-side' );
	$bad_quote_phone = request_for( array(), array(), array_merge( $billing, array( 'phone' => '9876543210' ) ) );
	check( 422 === $controller->quote( $bad_quote_phone )->status, 'quote validates a supplied phone without requiring identity for initial quotes' );
	$GLOBALS['cart_unavailable'] = true;
	check( 422 === $controller->prepare( $guest )->status, 'unavailable cart item is rejected' );
	$GLOBALS['cart_unavailable'] = false;
	$GLOBALS['cart_items'] = array( array( 'product_id' => 7, 'price_id' => null, 'quantity' => 1, 'unit_price' => 0, 'available' => true ) );
	$free_headers = array( 'Idempotency-Key' => 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff' );
	$free = request_for( array(), $free_headers, $billing );
	$free_order = $controller->prepare( $free );
	check( 201 === $free_order->status && 'complete' === $free_order->data['data']['status'], 'zero-total guest order completes through native EDD status API' );
	$free_status_token = $free_order->data['data']['payment_authorization_token'] ?? '';
	check( preg_match( '/^[a-f0-9]{64}$/D', $free_status_token ) && hash( 'sha256', $free_status_token ) === $GLOBALS['order_meta'][1003]['ch_payment_authorization_hash'], 'completed free order gets a scoped status-read capability without enabling payment' );
	check( 'manual' === $GLOBALS['created_order_data'][2]['gateway'] && 0.0 === (float) $GLOBALS['created_order_data'][2]['total'] && 0 === (int) $GLOBALS['created_order_data'][2]['user_id'], 'free order uses EDD manual free-purchase gateway with zero total and guest ownership' );
	check( 'zero_total' === $GLOBALS['order_meta'][1003]['ch_checkout_type'] && 1 === $GLOBALS['completions'], 'zero-total order records checkout metadata and completes once' );
	$free_retry = $controller->prepare( $free );
	check( 200 === $free_retry->status && false === $free_retry->data['data']['created'] && 'complete' === $free_retry->data['data']['status'] && 1 === $GLOBALS['completions'] && 1 === count( $GLOBALS['created_order_data'] ) - 2, 'idempotent free-order retry returns the same completed order without duplicate completion' );
	check( $free_status_token === $free_retry->data['data']['payment_authorization_token'], 'idempotent free-order retry reuses its existing scoped status capability' );
	$GLOBALS['cart_items'] = array( array( 'product_id' => 8, 'price_id' => null, 'quantity' => 1, 'unit_price' => 1250, 'available' => true ) );
	$GLOBALS['coupon_percentage'] = 100;
	$coupon_free = request_for( array(), array( 'Idempotency-Key' => 'cccccccc-dddd-eeee-ffff-000000000000' ), $billing, 'SAVE' );
	$coupon_order = $controller->prepare( $coupon_free );
	check( 201 === $coupon_order->status && 'complete' === $coupon_order->data['data']['status'] && true === $GLOBALS['coupon_used'], 'valid 100-percent coupon completes zero-total order and is consumed by EDD completion' );
	$count_before_coupon_retry = count( $GLOBALS['created_order_data'] );
	$coupon_retry = $controller->prepare( $coupon_free );
	check( 200 === $coupon_retry->status && false === $coupon_retry->data['data']['created'] && 'complete' === $coupon_retry->data['data']['status'] && $count_before_coupon_retry === count( $GLOBALS['created_order_data'] ), 'same-key retry succeeds after coupon use without creating another completed order' );
	$GLOBALS['cart_items'] = array( array( 'product_id' => 7, 'price_id' => null, 'quantity' => 1, 'unit_price' => 0, 'available' => true ) );
	$GLOBALS['current_user'] = 42;
	$member_free = request_for( array(), array( 'Authorization' => 'Bearer valid', 'Idempotency-Key' => 'dddddddd-eeee-ffff-0000-111111111111' ), array( 'full_name' => 'Member Name', 'email' => 'ignored@example.test', 'phone' => '+14155552671', 'country' => 'IN' ) );
	$member_free_order = $controller->prepare( $member_free );
	check( 201 === $member_free_order->status && 'complete' === $member_free_order->data['data']['status'] && 42 === $GLOBALS['created_order_data'][4]['user_id'] && 900 === $GLOBALS['created_order_data'][4]['customer_id'] && 'member@example.test' === $GLOBALS['created_order_data'][4]['email'], 'authenticated zero-total order completes against the authenticated EDD customer' );
	check( 'test' === $GLOBALS['created_order_data'][0]['mode'] && 'test' === $GLOBALS['created_order_data'][1]['mode'] && 'ch_razorpay' === $GLOBALS['created_order_data'][1]['gateway'], 'paid custom Razorpay orders record test mode and use the custom gateway identifier' );
	check( 'test' === $GLOBALS['created_order_data'][2]['mode'] && 'test' === $GLOBALS['created_order_data'][3]['mode'] && 'test' === $GLOBALS['created_order_data'][4]['mode'], 'zero-total orders continue to follow EDD configured mode' );
	$GLOBALS['current_user'] = 0;
	$GLOBALS['cart_items'] = array( array( 'product_id' => 8, 'price_id' => null, 'quantity' => 1, 'unit_price' => 1250, 'available' => true ) );
	$no_key = request_for( array(), array(), $billing );
	check( 400 === $controller->prepare( $no_key )->status, 'missing idempotency key is rejected' );
	check( count( $GLOBALS['addresses'] ) === count( $GLOBALS['created_order_data'] ), 'billing address saved for each prepared order' );
	check( ! isset( $GLOBALS['download_permissions'] ) && ! isset( $GLOBALS['license_keys'] ) && ! isset( $GLOBALS['receipts'] ), 'pending flow does not grant entitlements or issue receipts/licenses' );
	$GLOBALS['product_limits'][77] = '1';
	$GLOBALS['product_sales'][77] = 0;
	$GLOBALS['reserved_qty'] = 0;
	$GLOBALS['cart_items'] = array( array( 'product_id' => 77, 'price_id' => null, 'quantity' => 1, 'unit_price' => 100, 'available' => true ) );
	$limit_key = array( 'Idempotency-Key' => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' );
	$limited_request = request_for( array( array( 'product_id' => 77, 'price_id' => null, 'quantity' => 1 ) ), $limit_key, $billing );
	$limited_first = $controller->prepare( $limited_request );
	check( 201 === $limited_first->status && 1 === $GLOBALS['reserved_qty'], 'limited product order persists its reservation atomically' );
	$other_key = array( 'Idempotency-Key' => 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' );
	check( 409 === $controller->prepare( request_for( array( array( 'product_id' => 77, 'price_id' => null, 'quantity' => 1 ) ), $other_key, $billing ) )->status, 'second checkout cannot reserve the final copy' );
	$limited_replay = $controller->prepare( $limited_request );
	check( 200 === $limited_replay->status && false === $limited_replay->data['data']['created'], 'identical retry returns its existing reservation without double-counting' );
	// Independent checkout uses the same order pipeline with a strict item guard.
	function independent_request( $key, $billing, $items, $discount = '' ) {
		return new FakeRequest( array( 'items' => $items, 'billing' => $billing, 'discount_code' => $discount, 'independent_free' => true ), array( 'Idempotency-Key' => $key, 'X-CH-Checkout-Rate-Token' => checkout_rate_token( str_repeat( 'a', 64 ) ) ) );
	}
	$GLOBALS['current_user'] = 0;
	$single_free = array( array( 'product_id' => 7, 'price_id' => null, 'quantity' => 1, 'unit_price' => 0, 'available' => true ) );
	$GLOBALS['cart_items'] = $single_free;
	$independent_key = '11111111-1111-4111-8111-111111111111';
	$independent = independent_request( $independent_key, $billing, $single_free );
	$before = count( $GLOBALS['created_order_data'] );
	$done = $controller->prepare( $independent );
	check( 201 === $done->status && 'complete' === $done->data['data']['status'], 'independent guest free order completes natively' );
	check( $before + 1 === count( $GLOBALS['created_order_data'] ) && 0 === end( $GLOBALS['created_order_data'] )['user_id'], 'independent order retains guest identification' );
	check( 200 === $controller->prepare( $independent )->status && $before + 1 === count( $GLOBALS['created_order_data'] ), 'independent duplicate submission reuses completed order' );
	$changed_billing = array_merge( $billing, array( 'email' => 'different@example.test' ) );
	check( 409 === $controller->prepare( independent_request( $independent_key, $changed_billing, $single_free ) )->status, 'editing email cannot create a duplicate free order with the same session key' );
	$GLOBALS['current_user'] = 42;
	$member_key = '22222222-2222-4222-8222-222222222222';
	$member_done = $controller->prepare( independent_request( $member_key, $billing, $single_free ) );
	check( 201 === $member_done->status && 42 === end( $GLOBALS['created_order_data'] )['user_id'] && 900 === end( $GLOBALS['created_order_data'] )['customer_id'], 'independent member order uses authenticated EDD customer' );
	$GLOBALS['current_user'] = 0;
	check( 403 === $controller->prepare( independent_request( $member_key, $billing, $single_free ) )->status, 'independent signed-in order cannot replay as guest' );
	$before = count( $GLOBALS['created_order_data'] );
	$blocked_key = '33333333-3333-4333-8333-333333333333';
	$GLOBALS['cart_items'][0]['unit_price'] = 200000;
	check( 422 === $controller->prepare( independent_request( $blocked_key, $billing, $single_free ) )->status, 'paid item rejected despite client zero price' );
	$GLOBALS['coupon_percentage'] = 100;
	check( 422 === $controller->prepare( independent_request( $blocked_key, $billing, $single_free, 'SAVE' ) )->status, 'coupon cannot turn a paid item into an independent free download' );
	$GLOBALS['cart_items'] = array_merge( $single_free, $single_free );
	check( 422 === $controller->prepare( independent_request( $blocked_key, $billing, $GLOBALS['cart_items'] ) )->status, 'independent checkout rejects multiple products' );
	$GLOBALS['cart_items'] = $single_free;
	$GLOBALS['cart_unavailable'] = true;
	check( 422 === $controller->prepare( independent_request( $blocked_key, $billing, $single_free ) )->status, 'unavailable independent product rejected' );
	$GLOBALS['cart_unavailable'] = false;
	check( $before === count( $GLOBALS['created_order_data'] ), 'rejected independent requests never create an order' );
	$GLOBALS['cart_items'] = array( array( 'product_id' => 78, 'price_id' => 0, 'quantity' => 1, 'unit_price' => 0, 'available' => true ) );
	$GLOBALS['product_limits'][78] = '1'; $GLOBALS['product_sales'][78] = 0; $GLOBALS['reserved_qty'] = 0;
	$limited_free_key = '44444444-4444-4444-8444-444444444444';
	$limited_free = independent_request( $limited_free_key, $billing, $GLOBALS['cart_items'] );
	check( 201 === $controller->prepare( $limited_free )->status, 'limited free option grants its final purchase once' );
	check( 200 === $controller->prepare( $limited_free )->status, 'limited free order replay works after consuming its final unit' );
	check( 409 === $controller->prepare( independent_request( $blocked_key, $billing, $GLOBALS['cart_items'] ) )->status, 'new free order cannot exceed existing purchase limit' );
	$GLOBALS['cart_items'] = array(
		array( 'product_id' => 7, 'price_id' => null, 'quantity' => 1, 'unit_price' => 0, 'available' => true ),
		array( 'product_id' => 8, 'price_id' => null, 'quantity' => 1, 'unit_price' => 0, 'available' => true ),
		array( 'product_id' => 9, 'price_id' => null, 'quantity' => 1, 'unit_price' => 0, 'available' => true ),
	);
	$regular_free = $controller->prepare( request_for( $GLOBALS['cart_items'], array( 'Idempotency-Key' => '55555555-5555-4555-8555-555555555555' ), $billing ) );
	check( 201 === $regular_free->status && 'complete' === $regular_free->data['data']['status'], 'regular three-free-item checkout completes as one EDD order' );
	$GLOBALS['cart_items'][1]['unit_price'] = 200000;
	$regular_mixed = $controller->prepare( request_for( $GLOBALS['cart_items'], array( 'Idempotency-Key' => '66666666-6666-4666-8666-666666666666' ), $billing ) );
	check( 201 === $regular_mixed->status && 'pending' === $regular_mixed->data['data']['status'] && 'ch_razorpay' === end( $GLOBALS['created_order_data'] )['gateway'], 'regular mixed cart retains paid Razorpay preparation' );

	$missing_token = new FakeRequest( array( 'items' => $GLOBALS['cart_items'], 'billing' => $billing ), array() );
	check( 400 === $controller->quote( $missing_token )->status, 'guest quote rejects missing trusted checkout identity' );
	$bad_token = new FakeRequest( array( 'items' => $GLOBALS['cart_items'], 'billing' => $billing ), array( 'X-CH-Checkout-Rate-Token' => str_repeat( 'a', 64 ) . '.' . str_repeat( 'b', 64 ) ) );
	check( 400 === $controller->quote( $bad_token )->status, 'guest quote rejects an unsigned checkout identity' );
	$GLOBALS['rate_filter_overrides']['ch_checkout_quote_rate_limit'] = 2;
	$quote_request = static function () use ( $controller, $billing ) { return $controller->quote( new FakeRequest( array( 'items' => $GLOBALS['cart_items'], 'billing' => $billing ), array( 'X-CH-Checkout-Rate-Token' => checkout_rate_token( str_repeat( 'c', 64 ) ) ) ) ); };
	check( 200 === $quote_request()->status && 200 === $quote_request()->status, 'guest quote allows requests up to its configurable limit' );
	$limited_quote = $quote_request();
	check( 429 === $limited_quote->status && isset( $limited_quote->headers['Retry-After'] ) && false !== strpos( $limited_quote->data['error']['message'], 'wait' ), 'quote limit returns a friendly retry response with Retry-After' );
	$GLOBALS['rate_filter_overrides']['ch_checkout_prepare_rate_limit'] = 1;
	foreach ( array_keys( $GLOBALS['transients'] ) as $transient_name ) { if ( 0 === strpos( $transient_name, 'ch_rate_checkout_' ) ) { delete_transient( $transient_name ); } }
	$prepare_headers = static function ( $key, $nonce ) { return array( 'Idempotency-Key' => $key, 'X-CH-Checkout-Rate-Token' => checkout_rate_token( str_repeat( $nonce, 64 ) ) ); };
	$rate_key_one = '77777777-7777-4777-8777-777777777777';
	$rate_first_request = request_for( $GLOBALS['cart_items'], $prepare_headers( $rate_key_one, 'd' ), $billing );
	$before_limited_orders = count( $GLOBALS['created_order_data'] );
	$rate_first = $controller->prepare( $rate_first_request );
	check( 201 === $rate_first->status && count( $GLOBALS['created_order_data'] ) === $before_limited_orders + 1, 'prepare limit permits the first new order for a guest identity' );
	check( 200 === $controller->prepare( $rate_first_request )->status && count( $GLOBALS['created_order_data'] ) === $before_limited_orders + 1, 'idempotent replay remains available at the new-order limit' );
	$changed_guest_billing = array_merge( $billing, array( 'email' => 'changed@example.test' ) );
	check( 429 === $controller->prepare( request_for( $GLOBALS['cart_items'], $prepare_headers( $rate_key_one, 'd' ), $changed_guest_billing ) )->status && count( $GLOBALS['created_order_data'] ) === $before_limited_orders + 1, 'changing checkout payload cannot reuse an idempotency key to bypass the limiter' );
	$rate_key_two = '88888888-8888-4888-8888-888888888888';
	$blocked = $controller->prepare( request_for( $GLOBALS['cart_items'], $prepare_headers( $rate_key_two, 'd' ), $billing ) );
	check( 429 === $blocked->status && count( $GLOBALS['created_order_data'] ) === $before_limited_orders + 1, 'rate-limited prepare creates no additional pending order' );
	check( 201 === $controller->prepare( request_for( $GLOBALS['cart_items'], $prepare_headers( $rate_key_two, 'e' ), $billing ) )->status, 'a separate signed guest token has an independent checkout bucket' );
	foreach ( array_keys( $GLOBALS['transients'] ) as $transient_name ) { if ( 0 === strpos( $transient_name, 'ch_rate_checkout_' ) ) { delete_transient( $transient_name ); } }
	$GLOBALS['current_user'] = 42;
	$member_rate_key = '99999999-9999-4999-8999-999999999999';
	$member_rate_request = request_for( $GLOBALS['cart_items'], $prepare_headers( $member_rate_key, 'f' ), $billing );
	$before_member_orders = count( $GLOBALS['created_order_data'] );
	check( 201 === $controller->prepare( $member_rate_request )->status, 'authenticated customer gets a user-scoped new-order allowance' );
	$member_rate_replay = request_for( $GLOBALS['cart_items'], $prepare_headers( $member_rate_key, 'g' ), $billing );
	check( 200 === $controller->prepare( $member_rate_replay )->status, 'authenticated retry remains independent of rotating guest-token values' );
	$member_blocked = request_for( $GLOBALS['cart_items'], $prepare_headers( 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'g' ), $billing );
	check( 429 === $controller->prepare( $member_blocked )->status && count( $GLOBALS['created_order_data'] ) === $before_member_orders + 1, 'authenticated user limit applies across guest-token values' );
	$GLOBALS['current_user'] = 0;
	echo "Checkout controller synthetic tests passed (including independent free checkout).\n";
}
