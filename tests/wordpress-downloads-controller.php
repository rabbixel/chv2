<?php
/** Isolated synthetic tests for the read-only EDD customer download library. */

namespace EDD\Orders {
	class Order {
		public $id; public $type = 'sale'; public $customer_id = 10; public $status = 'complete';
		public $date_created = '2026-01-01 00:00:00';
		public function __construct( $id, $customer_id = 10, $status = 'complete' ) { $this->id = $id; $this->customer_id = $customer_id; $this->status = $status; }
		public function get_number() { return 'CH-' . $this->id; }
	}
	class Order_Item {
		public $id; public $order_id; public $product_id; public $product_name; public $price_id;
		public $quantity; public $status = 'complete'; public $type = 'download';
		public function __construct( $id, $order_id, $product_id, $price_id, $quantity = 1, $status = 'complete' ) {
			$this->id = $id; $this->order_id = $order_id; $this->product_id = $product_id;
			$this->product_name = 'Purchased snapshot ' . $product_id; $this->price_id = $price_id;
			$this->quantity = $quantity; $this->status = $status;
		}
	}
}

namespace EDD\Downloads {
	class Entitlement {
		private $product_id; private $price_id;
		public function __construct( $product_id, $price_id = null ) { $this->product_id = $product_id; $this->price_id = $price_id; $GLOBALS['entitlement_calls'][] = array( $product_id, $price_id ); }
		public function get_files() { return $GLOBALS['entitled_files'][ $this->product_id . ':' . ( is_null( $this->price_id ) ? 'null' : $this->price_id ) ] ?? array(); }
	}
}

namespace {
	define( 'ABSPATH', __DIR__ );
	class WP_Error { public $code; public function __construct( $code ) { $this->code = $code; } }
	class WP_REST_Server { const READABLE = 'GET'; }
	class WP_REST_Response { public $data; public $status; public $headers = array(); public function __construct( $data, $status = 200 ) { $this->data = $data; $this->status = $status; } public function header( $name, $value ) { $this->headers[ $name ] = $value; } }
	class CH_Auth_Controller { public function session_permission( $request ) { return $GLOBALS['session_valid'] ? true : new WP_Error( 'invalid_session' ); } }
	class CH_API {
		const NAMESPACE = 'ch/v1';
		public static function success( $data, $status = 200 ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data ), $status ); }
		public static function collection( $data, $pagination, $status = 200 ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data, 'pagination' => $pagination ), $status ); }
		public static function error( $code, $message, $status ) { return new WP_REST_Response( array( 'success' => false, 'error' => array( 'code' => $code, 'message' => $message ) ), $status ); }
	}
	class CH_Media { public function featured_image( $id ) { $GLOBALS['featured_image_ids'][] = $id; return 123 === (int) $id ? array( 'url' => 'https://media.example.test/456.jpg' ) : null; } }
	class TestRequest { private $params; public function __construct( $params = array() ) { $this->params = $params; } public function get_param( $key ) { return $this->params[ $key ] ?? null; } }
	function register_rest_route( $namespace, $route, $args ) { $GLOBALS['routes'][ $route ] = $args; }
	function is_wp_error( $value ) { return $value instanceof WP_Error; }
	function get_current_user_id() { return $GLOBALS['current_user_id']; }
	function sanitize_text_field( $value ) { return strip_tags( (string) $value ); }
	function absint( $value ) { return abs( (int) $value ); }
	function mysql_to_rfc3339( $value ) { return gmdate( 'c', strtotime( $value ) ); }
	function wp_json_encode( $value ) { return json_encode( $value ); }
	function edd_get_customer_by( $field, $user_id ) { $GLOBALS['customer_lookup_field'] = $field; return $GLOBALS['customer']; }
	function edd_count_orders( $args ) {
		$GLOBALS['order_filter_args'] = $args;
		return count( array_filter( $GLOBALS['all_orders'], static function ( $order ) use ( $args ) {
			return (int) $order->customer_id === (int) $args['customer_id'] && 'sale' === $order->type && in_array( $order->status, $args['status__in'], true );
		} ) );
	}
	function edd_get_orders( $args ) {
		$GLOBALS['orders_query_args'] = $args;
		$orders = array_values( array_filter( $GLOBALS['all_orders'], static function ( $order ) use ( $args ) {
			return (int) $order->customer_id === (int) $args['customer_id'] && 'sale' === $order->type && in_array( $order->status, $args['status__in'], true );
		} ) );
		$GLOBALS['filtered_orders'] = $orders;
		return array_slice( $orders, (int) ( $args['offset'] ?? 0 ), (int) $args['number'] );
	}
	function edd_get_order_items( $args ) {
		$GLOBALS['items_query_args'] = $args;
		return array_values( array_filter( $GLOBALS['all_items'], static function ( $item ) use ( $args ) {
			return in_array( $item->order_id, $args['order_id__in'], true ) && in_array( $item->status, $args['status__in'], true );
		} ) );
	}
	function edd_get_deliverable_order_item_statuses() { return array( 'complete', 'partially_refunded' ); }
	function get_posts( $args ) { return $args['post_type'] === 'download' ? $GLOBALS['products'] : array(); }
	function get_post_thumbnail_id( $post_id ) { return (int) $post_id === 123 ? 456 : 0; }
	function get_the_title( $post ) { return 'Betty&#8217;s Cakes'; }

	require_once __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-downloads-controller.php';

	function check( $condition, $message ) {
		if ( ! $condition ) { fwrite( STDERR, "FAIL: {$message}\n" ); exit( 1 ); }
		++$GLOBALS['assertions'];
	}

	$GLOBALS['assertions'] = 0;
	$GLOBALS['session_valid'] = true;
	$GLOBALS['current_user_id'] = 55;
	$GLOBALS['customer'] = (object) array( 'id' => 10, 'user_id' => 55 );
	$good = new \EDD\Orders\Order( 501 );
	$partial = new \EDD\Orders\Order( 502, 10, 'partially_refunded' );
	$failed = new \EDD\Orders\Order( 503, 10, 'failed' );
	$abandoned = new \EDD\Orders\Order( 504, 10, 'abandoned' );
	$pending = new \EDD\Orders\Order( 505, 10, 'pending' );
	$GLOBALS['all_orders'] = array( $good, $partial, $failed, $abandoned, $pending );
	$GLOBALS['filtered_orders'] = array();
	$GLOBALS['all_items'] = array(
		new \EDD\Orders\Order_Item( 11, 501, 123, 2, 3 ),
		new \EDD\Orders\Order_Item( 12, 502, 123, null, 1 ),
		new \EDD\Orders\Order_Item( 13, 502, 777, 1, 1 ),
		new \EDD\Orders\Order_Item( 14, 503, 123, 2, 1 ),
		new \EDD\Orders\Order_Item( 15, 501, 123, 1, 1, 'refunded' ),
		new \EDD\Orders\Order_Item( 16, 505, 123, 2, 1 ),
	);
	$GLOBALS['all_items'][2]->product_name = '&lt;script&gt;alert(1)&lt;/script&gt;Betty&#8217;s';
	$GLOBALS['products'] = array( (object) array( 'ID' => 123, 'post_name' => 'product-one' ) );
	$GLOBALS['entitled_files'] = array(
		'123:2' => array( array( 'file' => 'private-s3-object-key', 'name' => 'private-file-name.zip' ) ),
		'123:null' => array(),
	);
	$GLOBALS['entitlement_calls'] = array();
	$GLOBALS['featured_image_ids'] = array();
	$controller = new \CH_Downloads_Controller( new \CH_Auth_Controller() );
	$controller->register_routes();
	$route = $GLOBALS['routes']['/customer/downloads'];
	check( isset( $route ) && 'GET' === $route['methods'], 'registers the read-only downloads endpoint' );
	$GLOBALS['session_valid'] = false;
	check( is_wp_error( $route['permission_callback']( new TestRequest() ) ), 'unauthenticated requests are rejected' );
	$GLOBALS['session_valid'] = true;
	check( $controller->validate_positive_integer( '1' ) && ! $controller->validate_positive_integer( '0' ), 'validates page numbers' );
	check( $controller->validate_page_size( '50' ) && ! $controller->validate_page_size( '51' ), 'caps page size at fifty' );

	$result = $controller->list_downloads( new TestRequest( array( 'page' => 1, 'per_page' => 20 ) ) );
	check( 200 === $result->status && 2 === count( $result->data['data'] ), 'returns purchases from complete and partially refunded orders' );
	check( 'user_id' === $GLOBALS['customer_lookup_field'] && 10 === $GLOBALS['order_filter_args']['customer_id'], 'resolves orders through the linked customer identity' );
	check( array( 'complete', 'partially_refunded' ) === $GLOBALS['orders_query_args']['status__in'], 'excludes failed and abandoned orders' );
	check( ! in_array( 505, array_map( static function ( $order ) { return $order->id; }, $GLOBALS['filtered_orders'] ), true ), 'pending orders are excluded from download entitlements' );
	check( 'status__in' === array_key_first( array_intersect_key( $GLOBALS['items_query_args'], array( 'status__in' => true ) ) ), 'queries only deliverable order item statuses' );
	check( 2 === count( $GLOBALS['entitlement_calls'] ), 'evaluates each line item using its purchased price ID' );
	check( 'https://media.example.test/456.jpg' === $result->data['data'][0]['items'][0]['thumbnail_url'] && array( 123, 123 ) === $GLOBALS['featured_image_ids'], 'uses the featured-image full-size resolver rather than a generated variation' );
	check( 'Betty’s Cakes' === $result->data['data'][0]['items'][0]['title'] && false === strpos( $result->data['data'][1]['items'][1]['title'], '<script' ), 'decodes entity titles and strips decoded markup from safe plain text' );
	check( 2 === $result->data['data'][0]['items'][0]['price_id'] && 3 === $result->data['data'][0]['items'][0]['quantity'], 'preserves variable price ID and purchased quantity' );
	check( 'delivery_disabled' === $result->data['data'][0]['items'][0]['availability'] && false === $result->data['data'][0]['items'][0]['download_enabled'], 'reports configured file availability without enabling download' );
	check( 'no_entitled_files' === $result->data['data'][1]['items'][0]['availability'], 'reports no entitlement for an unassigned price option' );
	check( 'product_unavailable' === $result->data['data'][1]['items'][1]['availability'] && null === $result->data['data'][1]['items'][1]['thumbnail_url'], 'retains deleted product purchase snapshots without a broken image' );
	$encoded = wp_json_encode( $result->data );
	check( false === strpos( $encoded, 'private-s3-object-key' ) && false === strpos( $encoded, 'private-file-name.zip' ) && false === strpos( $encoded, 'signed' ), 'never returns file paths, keys, names or signed URLs' );
	check( 2 === count( $result->data['data'] ) && 123 === $result->data['data'][0]['items'][0]['product_id'] && 123 === $result->data['data'][1]['items'][0]['product_id'], 'keeps separate repeated purchases of the same product' );

	$GLOBALS['customer'] = false;
	$empty = $controller->list_downloads( new TestRequest() );
	check( 200 === $empty->status && array() === $empty->data['data'], 'customer with no linked EDD identity receives an empty library' );
	$GLOBALS['customer'] = (object) array( 'id' => 10, 'user_id' => 55 );
	$GLOBALS['session_valid'] = false;
	check( is_wp_error( $route['permission_callback']( new TestRequest() ) ), 'expired session is rejected by the authentication bridge' );
	echo 'PASS: ' . $GLOBALS['assertions'] . " WordPress downloads controller assertions\n";
}
