<?php
/** Synthetic tests for Creative Hatti's EDD customer download authorization layer. */
define( 'ABSPATH', __DIR__ );
eval( 'namespace EDD\\Orders; class Order { public $id; public $type; public $status; public $customer_id; public $date_created; public $gateway; public $user_id; public function get_number() { return (string) $this->id; } }' );
class CH_Auth_Controller {}
class CH_Media { public function featured_image( $id ) { return array(); } }
class WP_Error {}
class CH_API { public static function error( $code, $message, $status ) { return array( 'error' => $code, 'status' => $status ); } public static function collection( $items, $pagination ) { return array( 'items' => $items, 'pagination' => $pagination ); } }
class Request { private $params; public function __construct( $params = array() ) { $this->params = $params; } public function get_param( $key ) { return $this->params[ $key ] ?? null; } }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function absint( $value ) { return abs( (int) $value ); }
function get_current_user_id() { return $GLOBALS['current_user_id']; }
function edd_get_customer_by( $field, $value ) { return $value ? (object) array( 'id' => 4, 'user_id' => $value ) : false; }
function edd_get_orders( $args ) { return array_values( array_filter( $GLOBALS['orders'], static function ( $order ) use ( $args ) { return (int) $order->customer_id === (int) $args['customer_id'] && $order->type === $args['type'] && in_array( $order->status, $args['status__in'], true ); } ) ); }
function edd_count_orders( $args ) { return count( edd_get_orders( $args ) ); }
function edd_get_order_items( $args ) { return array_values( array_filter( $GLOBALS['items'], static function ( $item ) use ( $args ) { return in_array( (int) $item->order_id, array_map( 'intval', $args['order_id__in'] ), true ) && in_array( $item->status, $args['status__in'], true ); } ) ); }
function edd_get_deliverable_order_item_statuses() { return array( 'complete', 'partially_refunded' ); }
function get_posts( $args ) { return 'download' === $args['post_type'] ? $GLOBALS['products'] : array(); }
function get_post_thumbnail_id( $id ) { return 0; }
function get_the_title( $post ) { return $post->post_title; }
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function edd_get_download( $id ) { return false; }
function mysql_to_rfc3339( $value ) { return '2026-01-01T00:00:00+00:00'; }
require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-downloads-controller.php';

$GLOBALS['current_user_id'] = 77;
$GLOBALS['orders'] = array();
foreach ( array( 1 => 'complete', 2 => 'partially_refunded', 3 => 'refunded', 4 => 'complete' ) as $id => $status ) {
	$order = new EDD\Orders\Order();
	$order->id = $id;
	$order->type = 'sale';
	$order->status = $status;
	$order->customer_id = 4 === $id ? 999 : 4;
	$order->gateway = 'manual';
	$order->date_created = '2026-01-01 00:00:00';
	$GLOBALS['orders'][ $id ] = $order;
}
$GLOBALS['products'] = array( (object) array( 'ID' => 88, 'post_name' => 'synthetic-asset', 'post_title' => 'Synthetic asset' ) );
$GLOBALS['items'] = array(
	(object) array( 'id' => 101, 'order_id' => 1, 'product_id' => 88, 'product_name' => 'Synthetic asset', 'price_id' => null, 'quantity' => 1, 'status' => 'complete' ),
	(object) array( 'id' => 102, 'order_id' => 2, 'product_id' => 88, 'product_name' => 'Synthetic asset', 'price_id' => null, 'quantity' => 1, 'status' => 'complete' ),
	(object) array( 'id' => 103, 'order_id' => 3, 'product_id' => 88, 'product_name' => 'Synthetic asset', 'price_id' => null, 'quantity' => 1, 'status' => 'refunded' ),
	(object) array( 'id' => 104, 'order_id' => 4, 'product_id' => 88, 'product_name' => 'Synthetic asset', 'price_id' => null, 'quantity' => 1, 'status' => 'complete' ),
);
$controller = new CH_Downloads_Controller( new CH_Auth_Controller() );
$result = $controller->list_downloads( new Request() );
$visible_order_ids = array_column( $result['items'], 'order_id' );
if ( array( 1, 2 ) !== $visible_order_ids ) {
	fwrite( STDERR, "FAIL: refunded and other-customer orders must not appear; partial refunds remain visible\n" );
	exit( 1 );
}
if ( false === $result['items'][1]['items'][0]['download_enabled'] ) {
	// Listing a partial purchase is intentional; the current backend does not mint a link in this endpoint.
	echo "Download entitlement tests: 2 passed, 0 failed.\n";
	exit( 0 );
}
fwrite( STDERR, "FAIL: downloads API unexpectedly enabled direct delivery\n" );
exit( 1 );
