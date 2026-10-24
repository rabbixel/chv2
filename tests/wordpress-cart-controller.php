<?php
/** Synthetic, isolated checks for server-side cart validation. */
namespace {
	define( 'ABSPATH', __DIR__ );
	class WP_REST_Server { const CREATABLE = 'POST'; }
	class WP_Error { public $code; public function __construct( $code ) { $this->code = $code; } }
	class WP_REST_Response { public $data; public $status; public $headers = array(); public function __construct( $data, $status = 200 ) { $this->data = $data; $this->status = $status; } public function header( $key, $value ) { $this->headers[ $key ] = $value; } }
	class CH_API { const NAMESPACE = 'ch/v1'; public static function success( $data, $status = 200 ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data ), $status ); } public static function error( $code, $message, $status ) { return new WP_REST_Response( array( 'success' => false, 'error' => array( 'code' => $code ) ), $status ); } }
	class FakeWpdb { public $prefix = 'wp_'; public function prepare( $query, ...$args ) { return array( $query, $args ); } public function get_var( $prepared ) { return false !== strpos( $prepared[0], 'GET_LOCK' ) ? '1' : '0'; } }
	$GLOBALS['wpdb'] = new FakeWpdb();
	class FakeAuth { public function bridge_permission( $request ) { return $GLOBALS['bridge_ok'] ? true : new WP_Error( 'bridge' ); } public function session_permission( $request ) { return $GLOBALS['session_ok'] ? true : new WP_Error( 'session' ); } }
	class FakeDownload { public $id; public function __construct( $id ) { $this->id = $id; } public function can_purchase() { return 1 !== $this->id; } public function quantities_disabled() { return false; } }
	class FakeRequest { private $params; private $headers; public function __construct( $params, $headers = array() ) { $this->params = $params; $this->headers = $headers; } public function get_param( $key ) { return $this->params[ $key ] ?? null; } public function get_header( $key ) { return $this->headers[ strtolower( $key ) ] ?? ''; } }
	function register_rest_route( $namespace, $route, $args ) { $GLOBALS['routes'][ $route ] = $args; }
	function absint( $value ) { return abs( (int) $value ); }
	function sanitize_text_field( $value ) { return strip_tags( (string) $value ); }
	function wp_strip_all_tags( $value ) { return strip_tags( (string) $value ); }
	function edd_item_quantities_enabled() { return $GLOBALS['quantities']; }
	function get_post_meta( $id, $key, $single = true ) { if ( '_edd_purchase_limit' === $key ) { return $GLOBALS['limits'][ $id ] ?? ''; } if ( '_edd_download_sales' === $key ) { return (string) ( $GLOBALS['sales'][ $id ] ?? 0 ); } return ''; }
	function edd_get_download_sales_stats( $id ) { return $GLOBALS['sales'][ $id ] ?? 0; }
	function edd_get_currency() { return 'INR'; }
	function edd_get_download( $id ) { return 99 === $id ? false : new FakeDownload( $id ); }
	function get_post_status( $id ) { return 1 === $id ? 'draft' : 'publish'; }
	function edd_has_variable_prices( $id ) { return 20 === $id; }
	function edd_get_variable_prices( $id ) { return array( 0 => array( 'name' => 'Standard', 'amount' => 10 ), 2 => array( 'name' => 'Bundle', 'amount' => 25 ) ); }
	function edd_get_price_option_amount( $id, $price_id ) { return edd_get_variable_prices( $id )[ $price_id ]['amount']; }
	function edd_get_download_price( $id ) { return 12.5; }
	function edd_pl_is_item_sold_out( $id, $price_id, $a = false, $b = false ) { return false; }
	function edd_pl_get_file_purchase_limit( $id, $type = null, $price_id = null ) { return 6 === $id ? 1 : 0; }
	function edd_pl_get_file_purchases( $id, $price_id = null ) { return 0; }
	function get_the_title( $id ) { return 'Product ' . $id; }
	function get_post_field( $field, $id ) { return 'product-' . $id; }
	function get_the_post_thumbnail_url( $id, $size ) { return 'https://example.test/' . $id . '.jpg'; }
	require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-purchase-limit-service.php';
	require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-cart-controller.php';
	function check( $ok, $message ) { if ( ! $ok ) { fwrite( STDERR, "FAIL: $message\n" ); exit( 1 ); } }
	$GLOBALS['bridge_ok'] = true; $GLOBALS['session_ok'] = true; $GLOBALS['quantities'] = false; $GLOBALS['limits'] = array( 6 => '1', 161470 => '-1', 162003 => '1', 167346 => '1', 168794 => '1' ); $GLOBALS['sales'] = array( 162003 => 1, 167346 => 1, 168794 => 1 );
	$controller = new \CH_Cart_Controller( new FakeAuth() );
	$guest = new FakeRequest( array( 'items' => array() ) );
	check( true === $controller->bridge_permission( $guest ), 'trusted guest bridge is allowed' );
	$GLOBALS['bridge_ok'] = false; check( $controller->bridge_permission( $guest ) instanceof WP_Error, 'untrusted request is rejected' ); $GLOBALS['bridge_ok'] = true;
	$GLOBALS['session_ok'] = false;
	check( $controller->bridge_permission( new FakeRequest( array(), array( 'authorization' => 'Bearer expired' ) ) ) instanceof WP_Error, 'expired authenticated session is rejected' );
	$GLOBALS['session_ok'] = true;
	$single = $controller->validate( new FakeRequest( array( 'items' => array( array( 'product_id' => 5, 'price_id' => null, 'quantity' => 2, 'unit_price' => 1, 'line_total' => 2 ) ) ) ) );
	check( 1250 === $single->data['data']['items'][0]['unit_price'], 'EDD simple product price is authoritative' );
	check( 1250 === $single->data['data']['subtotal'], 'client-supplied price and total are ignored' );
	check( 1 === $single->data['data']['items'][0]['quantity'], 'quantity disabled by EDD is forced to one' );
	$variable = $controller->validate( new FakeRequest( array( 'items' => array( array( 'product_id' => 20, 'price_id' => 2, 'quantity' => 1 ) ) ) ) );
	check( 2500 === $variable->data['data']['items'][0]['unit_price'], 'selected EDD variable price is returned' );
	$invalid_price = $controller->validate( new FakeRequest( array( 'items' => array( array( 'product_id' => 20, 'price_id' => 999, 'quantity' => 1 ) ) ) ) );
	check( false === $invalid_price->data['data']['items'][0]['available'], 'invalid price option is unavailable' );
	$draft = $controller->validate( new FakeRequest( array( 'items' => array( array( 'product_id' => 1, 'price_id' => null, 'quantity' => 1 ) ) ) ) );
	check( false === $draft->data['data']['items'][0]['available'], 'unpublished product is unavailable' );
	$invalid_product = $controller->validate( new FakeRequest( array( 'items' => array( array( 'product_id' => 99, 'price_id' => null, 'quantity' => 1 ) ) ) ) );
	check( false === $invalid_product->data['data']['items'][0]['available'], 'deleted product remains removable as unavailable' );
	$duplicate = $controller->validate( new FakeRequest( array( 'items' => array( array( 'product_id' => 5, 'price_id' => null, 'quantity' => 1 ), array( 'product_id' => 5, 'price_id' => null, 'quantity' => 1 ) ) ) ) );
	check( 1 === count( $duplicate->data['data']['items'] ), 'duplicate product and price collapse to one line' );
	check( 0 === $duplicate->data['data']['items'][0]['quantity'] - 1, 'quantity remains one when EDD disables quantities' );
	$GLOBALS['quantities'] = true;
	$over_limit = $controller->validate( new FakeRequest( array( 'items' => array( array( 'product_id' => 6, 'price_id' => null, 'quantity' => 2 ) ) ) ) );
	check( false === $over_limit->data['data']['items'][0]['available'], 'requested quantity cannot exceed EDD purchase limit' );
	foreach ( array( 161470, 162003, 167346, 168794 ) as $historical_id ) {
		$historical_sold_out = $controller->validate( new FakeRequest( array( 'items' => array( array( 'product_id' => $historical_id, 'price_id' => null, 'quantity' => 1 ) ) ) ) );
		check( false === $historical_sold_out->data['data']['items'][0]['available'], 'historical sold-out product ' . $historical_id . ' remains unavailable' );
	}
	$GLOBALS['quantities'] = false;
	check( false !== strpos( $single->headers['Cache-Control'], 'no-store' ), 'cart responses are not cached' );
	$too_many_items = array_fill( 0, 21, array( 'product_id' => 5, 'price_id' => null, 'quantity' => 1 ) );
	$too_many = $controller->validate( new FakeRequest( array( 'items' => $too_many_items ) ) );
	check( 400 === $too_many->status, 'oversized cart rejected' );
	echo "Cart controller synthetic tests passed.\n";
}
