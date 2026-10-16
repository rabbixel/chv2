<?php
/** Isolated synthetic tests for authenticated EDD order history. */

namespace EDD\Orders {
	class Order {
		public $id; public $type = 'sale'; public $customer_id = 10; public $user_id = 0;
		public $status = 'complete'; public $parent = 0; public $date_created = '2026-01-01 00:00:00';
		public $currency = 'INR'; public $subtotal = 10; public $discount = 0; public $tax = 1; public $total = 11; public $gateway = 'test';
		public function __construct( $id, $customer_id = 10, $status = 'complete' ) { $this->id = $id; $this->customer_id = $customer_id; $this->status = $status; }
		public function get_number() { return 'CH-' . $this->id; }
	}
	class Order_Item {
		public $id; public $order_id; public $product_id; public $product_name; public $quantity = 1;
		public $amount = 10; public $total = 10; public $price_id = null;
		public function __construct( $id, $order_id, $product_id, $name ) { $this->id = $id; $this->order_id = $order_id; $this->product_id = $product_id; $this->product_name = $name; }
	}
}

namespace {
	define( 'ABSPATH', __DIR__ );
	class WP_Error { public $code; public function __construct( $code ) { $this->code = $code; } }
	class WP_REST_Server { const READABLE = 'GET'; }
	class WP_REST_Response { public $data; public $status; public function __construct( $data, $status = 200 ) { $this->data = $data; $this->status = $status; } }
	class CH_Auth_Controller { public function session_permission( $request ) { return $GLOBALS['session_valid'] ? true : new WP_Error( 'invalid_session' ); } }
	class CH_API {
		const NAMESPACE = 'ch/v1';
		public static function success( $data, $status = 200 ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data ), $status ); }
		public static function collection( $data, $pagination, $status = 200 ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data, 'pagination' => $pagination ), $status ); }
		public static function error( $code, $message, $status ) { return new WP_REST_Response( array( 'success' => false, 'error' => array( 'code' => $code, 'message' => $message ) ), $status ); }
	}
	class CH_Media { public function attachment( $id, $size = 'full' ) { return $id ? array( 'url' => 'https://media.example.test/' . $id . '.jpg' ) : null; } }
	class TestRequest { private $params; public function __construct( $params = array() ) { $this->params = $params; } public function get_param( $key ) { return $this->params[ $key ] ?? null; } }
	function register_rest_route( $namespace, $route, $args ) { $GLOBALS['routes'][ $route ] = $args; }
	function is_wp_error( $value ) { return $value instanceof WP_Error; }
	function get_current_user_id() { return $GLOBALS['current_user_id']; }
	function sanitize_text_field( $value ) { return strip_tags( (string) $value ); }
	function sanitize_key( $value ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) ); }
	function absint( $value ) { return abs( (int) $value ); }
	function mysql_to_rfc3339( $value ) { return gmdate( 'c', strtotime( $value ) ); }
	function edd_get_customer_by( $field, $user_id ) { $GLOBALS['customer_lookup_field'] = $field; return $GLOBALS['customer']; }
	function edd_count_orders( $args ) { $GLOBALS['count_args'] = $args; return $GLOBALS['total_orders']; }
	function edd_get_orders( $args ) {
		$GLOBALS['order_queries'][] = $args;
		if ( isset( $args['type'] ) && 'refund' === $args['type'] ) return $GLOBALS['refunds'];
		if ( isset( $args['parent'] ) ) return $GLOBALS['orders'][ (int) $args['parent'] ] ?? false;
		return $GLOBALS['orders_page'];
	}
	function edd_get_order( $id ) { return $GLOBALS['order_by_id'][ (int) $id ] ?? false; }
	function edd_get_order_items( $args ) { ++$GLOBALS['item_query_count']; return $GLOBALS['items']; }
	function edd_get_order_adjustments( $args ) { $GLOBALS['adjustment_query_args'] = $args; return $GLOBALS['adjustments']; }
	function edd_get_payment_gateways() { return array( 'test' => array( 'admin_label' => 'Test payment' ) ); }
	function get_posts( $args ) { $GLOBALS['product_query_args'] = $args; return $GLOBALS['products']; }
	function get_post_thumbnail_id( $post_id ) { return (int) $post_id === 123 ? 456 : 0; }

	require_once __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-orders-controller.php';

	function check( $condition, $message ) {
		if ( ! $condition ) { fwrite( STDERR, "FAIL: {$message}\n" ); exit( 1 ); }
		++$GLOBALS['assertions'];
	}

	$GLOBALS['assertions'] = 0;
	$GLOBALS['session_valid'] = true;
	$GLOBALS['current_user_id'] = 55;
	$GLOBALS['customer'] = (object) array( 'id' => 10, 'user_id' => 55 );
	$GLOBALS['total_orders'] = 2;
	$GLOBALS['orders_page'] = array( new \EDD\Orders\Order( 501, 10 ), new \EDD\Orders\Order( 502, 10, 'pending' ) );
	$GLOBALS['order_by_id'] = array( 501 => $GLOBALS['orders_page'][0], 502 => $GLOBALS['orders_page'][1], 999 => new \EDD\Orders\Order( 999, 99 ) );
	$GLOBALS['items'] = array( new \EDD\Orders\Order_Item( 1, 501, 123, 'Existing product' ), new \EDD\Orders\Order_Item( 2, 502, 777, 'Deleted product snapshot' ) );
	$GLOBALS['products'] = array( (object) array( 'ID' => 123, 'post_name' => 'existing-product' ) );
	$GLOBALS['refunds'] = array();
	$refund = new \EDD\Orders\Order( 700, 10, 'complete' );
	$refund->type = 'refund'; $refund->parent = 501; $refund->total = -5; $refund->date_created = '2026-01-02 00:00:00';
	$GLOBALS['refunds'] = array( $refund );
	$GLOBALS['adjustments'] = array( (object) array( 'object_id' => 501, 'type' => 'fee', 'subtotal' => 2, 'tax' => 0, 'total' => 2, 'description' => 'private text must not be returned' ) );
	$GLOBALS['order_queries'] = array();
	$GLOBALS['item_query_count'] = 0;
	$controller = new \CH_Orders_Controller( new \CH_Auth_Controller() );
	$controller->register_routes();
	check( isset( $GLOBALS['routes']['/customer/orders'] ) && isset( $GLOBALS['routes']['/customer/orders/(?P<order_id>[0-9]+)'] ), 'registers the list and detail routes' );
	$GLOBALS['session_valid'] = false;
	check( is_wp_error( $GLOBALS['routes']['/customer/orders']['permission_callback']( new TestRequest() ) ), 'unauthenticated requests fail the session permission callback' );
	$GLOBALS['session_valid'] = true;
	check( true === $GLOBALS['routes']['/customer/orders']['permission_callback']( new TestRequest() ), 'a validated session passes the permission callback' );
	check( $controller->validate_positive_integer( '1' ) && ! $controller->validate_positive_integer( '1.2' ), 'validates positive integer parameters' );
	check( ! $controller->validate_positive_integer( '100000' ) && $controller->validate_page_size( '50' ) && ! $controller->validate_page_size( '51' ), 'rejects invalid pagination and caps page size at fifty' );

	$list = $controller->list_orders( new TestRequest( array( 'page' => 1, 'per_page' => 20 ) ) );
	check( 200 === $list->status && 2 === count( $list->data['data'] ), 'lists multiple customer orders across complete and pending statuses' );
	check( 'user_id' === $GLOBALS['customer_lookup_field'], 'resolves customer only by the trusted WordPress user ID' );
	check( 10 === $GLOBALS['count_args']['customer_id'] && ! isset( $GLOBALS['count_args']['email'] ), 'order lookup is restricted to customer ID, never email' );
	check( 0 === $GLOBALS['orders_page'][0]->user_id && 10 === $GLOBALS['orders_page'][0]->customer_id, 'includes guest-era orders with an assigned customer ID' );
	check( 1 === $GLOBALS['item_query_count'], 'loads page items in one batched query' );
	check( null === $list->data['data'][1]['items'][0]['thumbnail_url'], 'deleted products retain item snapshot and omit thumbnail' );
	check( 'Test payment' === $list->data['data'][0]['payment_method'], 'returns the safe gateway label only' );
	check( 1 === count( $list->data['data'][0]['refunds'] ) && 1 === count( $list->data['data'][0]['adjustments'] ), 'returns native refund and adjustment summaries' );
	check( ! isset( $list->data['data'][0]['adjustments'][0]['description'] ), 'omits adjustment descriptions that could contain internal text' );
	check( ! isset( $list->data['data'][0]['email'] ) && ! isset( $list->data['data'][0]['payment_key'] ), 'does not expose customer identity or payment secrets' );
	check( 'DESC' === $GLOBALS['order_queries'][0]['order'] && array_key_exists( 'date_created', $GLOBALS['order_queries'][0]['orderby'] ), 'orders are newest first with deterministic date and ID sort keys' );

	$other = $controller->get_order( new TestRequest( array( 'order_id' => 999 ) ) );
	check( 404 === $other->status, 'does not allow access to another customer order' );
	$owned = $controller->get_order( new TestRequest( array( 'order_id' => 501 ) ) );
	check( 200 === $owned->status && 501 === $owned->data['data']['id'], 'returns an owned order detail' );

	$GLOBALS['customer'] = false;
	$empty = $controller->list_orders( new TestRequest() );
	check( 200 === $empty->status && array() === $empty->data['data'], 'customer without a linked EDD record receives an empty list' );
	$GLOBALS['customer'] = (object) array( 'id' => 10, 'user_id' => 55 );
	$GLOBALS['session_valid'] = false;
	check( is_wp_error( $GLOBALS['routes']['/customer/orders']['permission_callback']( new TestRequest() ) ), 'expired sessions are rejected' );

	echo 'PASS: ' . $GLOBALS['assertions'] . " WordPress order controller assertions\n";
}
