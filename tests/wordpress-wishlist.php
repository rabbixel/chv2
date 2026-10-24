<?php
/** Synthetic persistence, ownership, validation, and route-security tests. */
define( 'ABSPATH', __DIR__ . DIRECTORY_SEPARATOR );
define( 'ARRAY_A', 'ARRAY_A' );
class WP_Error {
	private $code; private $data;
	public function __construct( $code, $message = '', $data = null ) { $this->code = $code; $this->data = $data; }
	public function get_error_code() { return $this->code; }
	public function get_error_data() { return $this->data; }
}
class WP_Post { public $ID; public $post_type; public $post_status; public function __construct( $id, $type = 'download', $status = 'publish' ) { $this->ID = $id; $this->post_type = $type; $this->post_status = $status; } }
class WP_REST_Server { const READABLE = 'GET'; const CREATABLE = 'POST'; const DELETABLE = 'DELETE'; }
class WP_REST_Request { private $params; public function __construct( $params = array() ) { $this->params = $params; } public function get_param( $key ) { return $this->params[ $key ] ?? null; } }
class WP_REST_Response {
	public $data; public $headers = array(); public $status;
	public function __construct( $data, $status = 200 ) { $this->data = $data; $this->status = $status; }
	public function header( $name, $value ) { $this->headers[ $name ] = $value; }
}
class FakeWishlistDb {
	public $prefix = 'wp_'; public $last_error = ''; public $rows = array();
	public function prepare( $sql, ...$args ) { return array( $sql, $args ); }
	public function get_var( $query ) { return false !== strpos( $query[0], 'SHOW TABLES' ) ? 'wp_ch_wishlist_items' : null; }
	public function get_results( $query, $format ) { $user_id = (int) $query[1][0]; return array_values( array_filter( $this->rows, static function ( $row ) use ( $user_id ) { return $row['user_id'] === $user_id; } ) ); }
	public function query( $query ) {
		$sql = $query[0]; $args = $query[1];
		if ( false !== strpos( $sql, 'INSERT IGNORE' ) ) {
			foreach ( $this->rows as $row ) { if ( $row['user_id'] === (int) $args[0] && $row['product_id'] === (int) $args[1] ) { return 0; } }
			$this->rows[] = array( 'user_id' => (int) $args[0], 'product_id' => (int) $args[1], 'added_at' => $args[2] ); return 1;
		}
		if ( false !== strpos( $sql, 'DELETE FROM' ) ) {
			$before = count( $this->rows );
			$this->rows = array_values( array_filter( $this->rows, static function ( $row ) use ( $args ) { return $row['user_id'] !== (int) $args[0] || $row['product_id'] !== (int) $args[1]; } ) );
			return $before - count( $this->rows );
		}
		return false;
	}
}
class CH_API {
	const NAMESPACE = 'ch/v1';
	public static function success( $data ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data ) ); }
	public static function error( $code, $message, $status ) { return new WP_REST_Response( array( 'success' => false, 'error' => array( 'code' => $code ) ), $status ); }
}
class FakeWishlistAuth { public function session_permission( $request ) { return true; } }

$GLOBALS['wpdb'] = new FakeWishlistDb();
$GLOBALS['wishlist_user_id'] = 11;
$GLOBALS['wishlist_routes'] = array();
function get_option( $key, $default = false ) { return 'ch_api_wishlist_schema_version' === $key ? '1' : $default; }
function update_option( $key, $value, $autoload = null ) { return true; }
function absint( $value ) { return abs( (int) $value ); }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function sanitize_key( $value ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( $value ) ); }
function get_current_user_id() { return $GLOBALS['wishlist_user_id']; }
function get_post( $id ) { return in_array( (int) $id, array( 50, 51 ), true ) ? new WP_Post( (int) $id ) : ( 52 === (int) $id ? new WP_Post( 52, 'download', 'draft' ) : false ); }
function register_rest_route( $namespace, $route, $definition ) { $GLOBALS['wishlist_routes'][ $namespace . $route ] = $definition; }
require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-wishlist-service.php';
require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-wishlist-controller.php';

$passed = 0; $failed = 0;
function check_wishlist( $condition, $label ) { global $passed, $failed; if ( $condition ) { $passed++; } else { $failed++; fwrite( STDERR, "FAIL: {$label}\n" ); } }
$service = new CH_Wishlist_Service();
$first = $service->add_item( 11, 50 );
$duplicate = $service->add_item( 11, 50 );
check_wishlist( 1 === count( $first['items'] ) && 1 === count( $duplicate['items'] ), 'duplicate add is idempotent' );
$other_user = $service->add_item( 12, 50 );
check_wishlist( '11' === $first['customerId'] && '12' === $other_user['customerId'] && 2 === count( $GLOBALS['wpdb']->rows ), 'same product is stored separately per authenticated user' );
$removed = $service->remove_item( 11, 50 );
check_wishlist( 0 === count( $removed['items'] ) && 1 === count( $service->get_wishlist( 12 )['items'] ), 'remove affects only the requested owner' );
check_wishlist( is_wp_error( $service->add_item( 0, 50 ) ) && is_wp_error( $service->add_item( 11, 0 ) ), 'invalid customer and product IDs fail closed' );
$first_import = $service->import_historical_item( 12, 51, '2020-01-01 00:00:00' );
$repeat_import = $service->import_historical_item( 12, 51, '2021-01-01 00:00:00' );
check_wishlist( true === $first_import && false === $repeat_import && 1 === count( array_filter( $GLOBALS['wpdb']->rows, static function ( $row ) { return 12 === $row['user_id'] && 51 === $row['product_id']; } ) ), 'historical imports are idempotent and do not overwrite existing item timestamps' );

$auth = new FakeWishlistAuth();
$controller = new CH_Wishlist_Controller( $auth, $service );
$controller->register_routes();
$route = $GLOBALS['wishlist_routes']['ch/v1/wishlist'];
check_wishlist( 3 === count( $route ) && array( $auth, 'session_permission' ) === $route[0]['permission_callback'] && array( $auth, 'session_permission' ) === $route[1]['permission_callback'] && array( $auth, 'session_permission' ) === $route[2]['permission_callback'], 'GET, POST, and DELETE all require the verified WordPress session' );
$GLOBALS['wishlist_user_id'] = 11;
$response = $controller->add_item( new WP_REST_Request( array( 'productId' => 50, 'customerId' => 12 ) ) );
$session_owned_row = false;
foreach ( $GLOBALS['wpdb']->rows as $row ) { if ( 11 === $row['user_id'] && 50 === $row['product_id'] ) { $session_owned_row = true; } }
check_wishlist( $session_owned_row && false !== strpos( $response->headers['Cache-Control'], 'no-store' ), 'owner comes from the authenticated session and response is uncached' );
$invalid = $controller->add_item( new WP_REST_Request( array( 'productId' => 52 ) ) );
check_wishlist( 404 === $invalid->status, 'draft or invalid products cannot be added' );
$response = $controller->get_wishlist();
check_wishlist( '11' === $response->data['data']['customerId'] && 1 === count( $response->data['data']['items'] ), 'GET returns only the authenticated user wishlist' );

$service_source = file_get_contents( __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-wishlist-service.php' );
check_wishlist( false !== strpos( $service_source, 'UNIQUE KEY user_product (user_id,product_id)' ), 'persistent table has an atomic customer-product uniqueness constraint' );
if ( $failed ) { exit( 1 ); }
echo "Wishlist service/controller tests: {$passed} passed, {$failed} failed.\n";
