<?php
/** Isolated synthetic tests for the authenticated profile and licenses APIs. */

namespace {
	define( 'ABSPATH', __DIR__ );
	class EDD_SL_License {
		public $ID; public $download_id; public $payment_id; public $activation_count;
		public $price_id; public $key; public $expiration; public $lifetime;
		public function __construct( $row ) { foreach ( $row as $key => $value ) { $this->$key = $value; } }
		public function get_activation_limit() { return $this->limit; }
	}
	class FakeLicenseDB {
		public $rows;
		public function __construct( $rows ) { $this->rows = $rows; }
		public function count( $args ) { return count( array_filter( $this->rows, static function ( $row ) use ( $args ) { return $row->customer_id === $args['customer_id']; } ) ); }
		public function get_licenses( $args ) {
			$rows = array_values( array_filter( $this->rows, static function ( $row ) use ( $args ) { return $row->customer_id === $args['customer_id']; } ) );
			$rows = array_slice( $rows, $args['offset'], $args['number'] );
			return isset( $args['fields'] ) && 'ids' === $args['fields'] ? array_map( static function ( $row ) { return $row->id; }, $rows ) : array_map( static function ( $row ) { return new EDD_SL_License( $row ); }, $rows );
		}
		public function get( $id ) { foreach ( $this->rows as $row ) { if ( $row->id === $id ) return $row; } return false; }
	}
	class FakeLicenseMetaDB { public function get_meta( $id, $key, $single ) { return $GLOBALS['license_meta'][ $id . ':' . $key ] ?? ''; } }
	class FakeActivationDB { public function count( $args ) { return $GLOBALS['activation_counts'][ $args['license_id'] ] ?? 0; } }
	class FakeLicensing { public $licenses_db; public $license_meta_db; public $activations_db; public function __construct( $db ) { $this->licenses_db = $db; $this->license_meta_db = new FakeLicenseMetaDB(); $this->activations_db = new FakeActivationDB(); } public function force_increase() { return false; } }
	class WP_Error { public $code; public function __construct( $code ) { $this->code = $code; } }
	class WP_REST_Server { const READABLE = 'GET'; const EDITABLE = 'POST, PUT, PATCH'; }
	class WP_REST_Response { public $data; public $status; public $headers = array(); public function __construct( $data, $status = 200 ) { $this->data = $data; $this->status = $status; } public function header( $name, $value ) { $this->headers[ $name ] = $value; } }
	class CH_Auth_Controller { public function session_permission( $request ) { return $GLOBALS['session_valid'] ? true : new WP_Error( 'invalid_session' ); } }
	class CH_API {
		const NAMESPACE = 'ch/v1';
		public static function success( $data, $status = 200 ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data ), $status ); }
		public static function collection( $data, $pagination, $status = 200 ) { return new WP_REST_Response( array( 'success' => true, 'data' => $data, 'pagination' => $pagination ), $status ); }
		public static function error( $code, $message, $status ) { return new WP_REST_Response( array( 'success' => false, 'error' => array( 'code' => $code, 'message' => $message ) ), $status ); }
	}
	class TestRequest { private $params; public function __construct( $params = array() ) { $this->params = $params; } public function get_param( $key ) { return $this->params[ $key ] ?? null; } }
	function register_rest_route( $namespace, $route, $args ) { $GLOBALS['routes'][ $route ] = $args; }
	function is_wp_error( $value ) { return $value instanceof WP_Error; }
	function get_current_user_id() { return $GLOBALS['current_user_id']; }
	function wp_get_current_user() { return $GLOBALS['user']; }
	function get_user_by( $field, $id ) { return $GLOBALS['user']; }
	function get_user_meta( $id, $key, $single ) { return $GLOBALS['user_meta'][ $key ] ?? ''; }
	function wp_update_user( $fields ) { $GLOBALS['updated_fields'] = $fields; return $GLOBALS['update_fails'] ? new WP_Error( 'update_failed' ) : $fields['ID']; }
	function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
	function sanitize_key( $value ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) ); }
	function absint( $value ) { return abs( (int) $value ); }
	function edd_get_customer_by( $field, $user_id ) { $GLOBALS['customer_lookup_field'] = $field; return $GLOBALS['customer']; }
	function edd_software_licensing() { return $GLOBALS['licensing']; }
	function get_posts( $args ) { return array_values( array_filter( $GLOBALS['products'], static function ( $product ) use ( $args ) { return in_array( $product->ID, $args['post__in'], true ); } ) ); }
	function get_the_title( $product ) { return $product->post_title; }
	function current_time( $type, $gmt = false ) { return 1900000000; }
	function wp_json_encode( $value ) { return json_encode( $value ); }
	function edd_get_order( $id ) { return (object) array( 'id' => $id, 'get_number' => null ); }

	require_once __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-customer-controller.php';
	function check( $condition, $message ) { if ( ! $condition ) { fwrite( STDERR, "FAIL: {$message}\n" ); exit( 1 ); } ++$GLOBALS['assertions']; }
	function get_order_number_stub( $id ) { return 'ORDER-' . $id; }

	$GLOBALS['assertions'] = 0;
	$GLOBALS['session_valid'] = true;
	$GLOBALS['current_user_id'] = 55;
	$GLOBALS['user'] = (object) array( 'ID' => 55, 'user_email' => 'customer@example.test', 'display_name' => 'Customer Name', 'user_registered' => '2020-01-01 00:00:00' );
	$GLOBALS['user_meta'] = array( 'first_name' => 'Customer', 'last_name' => 'Name' );
	$GLOBALS['customer'] = (object) array( 'id' => 10, 'user_id' => 55 );
	$GLOBALS['products'] = array( (object) array( 'ID' => 501, 'post_name' => 'graphic-bundle', 'post_title' => 'Graphic Bundle', 'post_status' => 'publish' ) );
	$GLOBALS['license_meta'] = array( '1:_edd_sl_limit' => 5 );
	$GLOBALS['activation_counts'] = array( 1 => 2 );
	$GLOBALS['licensing'] = new FakeLicensing( new FakeLicenseDB( array(
		(object) array( 'id' => 1, 'customer_id' => 10, 'download_id' => 501, 'payment_id' => 900, 'price_id' => 1, 'license_key' => 'sensitive-license-key-1234', 'status' => 'active', 'expiration' => 2100000000, 'parent' => 0 ),
		(object) array( 'id' => 2, 'customer_id' => 20, 'download_id' => 999, 'payment_id' => 901, 'price_id' => null, 'license_key' => 'other-customers-secret', 'status' => 'inactive', 'expiration' => 0, 'parent' => 0 ),
		(object) array( 'id' => 3, 'customer_id' => 10, 'download_id' => 777, 'payment_id' => 902, 'price_id' => null, 'license_key' => 'deleted-product-secret', 'status' => 'expired', 'expiration' => 0, 'parent' => 0 ),
	) ) );
	$GLOBALS['update_fails'] = false;
	$controller = new CH_Customer_Controller( new CH_Auth_Controller() );
	$controller->register_routes();
	$license_route = $GLOBALS['routes']['/customer/licenses'];
	$profile_route = $GLOBALS['routes']['/customer/profile'];
	check( isset( $license_route, $profile_route ), 'registers licenses and profile endpoints' );
	$GLOBALS['session_valid'] = false;
	check( is_wp_error( $license_route['permission_callback']( new TestRequest() ) ) && is_wp_error( $profile_route[0]['permission_callback']( new TestRequest() ) ), 'rejects unauthenticated license and profile requests' );
	$GLOBALS['session_valid'] = true;
	check( $controller->validate_positive_integer( '2' ) && ! $controller->validate_positive_integer( '0' ), 'validates license page numbers' );
	check( $controller->validate_page_size( '50' ) && ! $controller->validate_page_size( '51' ), 'caps license page size' );
	check( $controller->validate_first_name( ' Name ' ) && ! $controller->validate_first_name( ' ' ) && ! $controller->validate_last_name( str_repeat( 'x', 201 ) ), 'validates profile name fields and lengths' );
	$licenses = $controller->list_licenses( new TestRequest( array( 'page' => 1, 'per_page' => 1 ) ) );
	check( 1 === count( $licenses->data['data'] ) && 2 === $licenses->data['pagination']['total_items'], 'paginates only licenses for the authenticated EDD customer' );
	$license = $licenses->data['data'][0];
	check( 501 === $license['product_id'] && 'Graphic Bundle' === $license['product_title'] && 900 === $license['purchase_id'], 'returns related product and purchase reference' );
	check( '••••••••••••1234' === $license['masked_key'] && false === strpos( wp_json_encode( $licenses->data ), 'sensitive-license-key' ), 'masks license keys and never serializes the full key' );
	check( 'active' === $license['status'] && 2 === $license['activation_count'] && 5 === $license['activation_limit'] && ! $license['lifetime'], 'returns status, activation count, limit and expiry information' );
	$second_page = $controller->list_licenses( new TestRequest( array( 'page' => 2, 'per_page' => 1 ) ) );
	check( false === $second_page->data['data'][0]['product_available'] && null === $second_page->data['data'][0]['product_url'], 'handles deleted licensed products without dropping records' );
	$GLOBALS['customer'] = false;
	$empty = $controller->list_licenses( new TestRequest() );
	check( array() === $empty->data['data'] && 0 === $empty->data['pagination']['total_items'], 'unlinked WordPress account receives an empty license list' );
	$GLOBALS['customer'] = (object) array( 'id' => 10, 'user_id' => 55 );
	$profile = $controller->get_profile();
	check( 'customer@example.test' === $profile->data['data']['profile']['email'] && ! isset( $profile->data['data']['profile']['id'] ) && ! isset( $profile->data['data']['profile']['roles'] ), 'returns only safe customer profile fields' );
	$updated = $controller->update_profile( new TestRequest( array( 'first_name' => 'New', 'last_name' => 'Name', 'role' => 'administrator', 'email' => 'attacker@example.test', 'customer_id' => 20 ) ) );
	check( 200 === $updated->status && ! isset( $GLOBALS['updated_fields']['role'] ) && ! isset( $GLOBALS['updated_fields']['user_email'] ) && ! isset( $GLOBALS['updated_fields']['customer_id'] ), 'profile update ignores role, email and customer ID fields' );
	$invalid = $controller->update_profile( new TestRequest( array( 'first_name' => ' ', 'last_name' => '' ) ) );
	check( 400 === $invalid->status, 'rejects invalid profile input' );
	$GLOBALS['update_fails'] = true;
	$failed = $controller->update_profile( new TestRequest( array( 'first_name' => 'Valid', 'last_name' => '' ) ) );
	check( 400 === $failed->status, 'returns safe error when WordPress profile update fails' );
	echo 'PASS: ' . $GLOBALS['assertions'] . " WordPress customer controller assertions\n";
}
