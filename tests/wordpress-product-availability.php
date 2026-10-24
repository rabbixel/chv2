<?php
/** Synthetic tests for the uncached product availability REST resource. */
define( 'ABSPATH', __DIR__ );
class WP_REST_Server { const READABLE = 'GET'; }
class WP_REST_Request implements ArrayAccess {
	private $params;
	public function __construct( $params ) { $this->params = $params; }
	public function offsetExists( $offset ): bool { return isset( $this->params[ $offset ] ); }
	public function offsetGet( $offset ): mixed { return $this->params[ $offset ] ?? null; }
	public function offsetSet( $offset, $value ): void { $this->params[ $offset ] = $value; }
	public function offsetUnset( $offset ): void { unset( $this->params[ $offset ] ); }
}
class WP_REST_Response {
	public $data; public $headers = array();
	public function __construct( $data, $status = 200 ) { $this->data = $data; }
	public function header( $name, $value ) { $this->headers[ $name ] = $value; }
}
class WP_Post { public $ID; public $post_type = 'download'; public $post_status = 'publish'; public function __construct( $id ) { $this->ID = $id; } }
class CH_Product_Transformer {}
class CH_API {
	const NAMESPACE = 'ch/v1';
	public static function success( $data ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data ) ); }
	public static function error( $code, $message, $status ) { return new WP_REST_Response( array( 'success' => false, 'error' => array( 'code' => $code ) ), $status ); }
}
class CH_Purchase_Limit_Service {
	public function availability( $id, $quantity ) { return array( 'available' => 161470 !== $id, 'sold_out' => 161470 === $id, 'remaining' => 161470 === $id ? 0 : 1 ); }
}
function get_post( $id ) { return in_array( (int) $id, array( 161470, 161873 ), true ) ? new WP_Post( (int) $id ) : false; }
function absint( $value ) { return abs( (int) $value ); }
require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-products-controller.php';

$controller = new CH_Products_Controller( new CH_Product_Transformer() );
$passed = 0;
$failed = 0;
function check_availability( $condition, $label ) { global $passed, $failed; if ( $condition ) { $passed++; } else { $failed++; fwrite( STDERR, "FAIL: {$label}\n" ); } }
$response = $controller->get_product_availability( new WP_REST_Request( array( 'ids' => '161470,161873,999999,161470' ) ) );
check_availability( true === $response->data['success'] && 2 === count( $response->data['data']['items'] ), 'only unique public product IDs are returned' );
check_availability( true === $response->data['data']['items'][0]['sold_out'] && false === $response->data['data']['items'][0]['available'], 'current sold-out state is preserved' );
check_availability( true === $response->data['data']['items'][1]['available'], 'currently available product remains purchasable' );
check_availability( false !== strpos( $response->headers['Cache-Control'], 'no-store' ), 'availability responses disable intermediary caching' );
$too_many = $controller->get_product_availability( new WP_REST_Request( array( 'ids' => implode( ',', range( 1, 49 ) ) ) ) );
check_availability( false === $too_many->data['success'], 'availability batch is bounded to 48 IDs' );
$invalid = $controller->get_product_availability( new WP_REST_Request( array( 'ids' => 'abc,0' ) ) );
check_availability( false === $invalid->data['success'], 'invalid product ID lists are rejected' );

if ( $failed ) { exit( 1 ); }
echo "Product availability controller tests: {$passed} passed, {$failed} failed.\n";
