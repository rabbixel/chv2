<?php
// Read-only integration checks against a local index; search uses temporary tables only.
if ( PHP_SAPI !== 'cli' ) { exit( 2 ); }
$path = $argv[1] ?? '';
if ( ! $path || ! is_file( $path . '/wp-load.php' ) ) { fwrite( STDERR, "Usage: verify-local-classification.php WORDPRESS_ROOT\n" ); exit( 2 ); }
$_SERVER['REQUEST_SCHEME'] = 'http';
$_SERVER['HTTP_HOST'] = 'creativehatti.test';
require $path . '/wp-load.php';
if ( ! class_exists( 'CH_Indexed_Search' ) || ! get_option( 'ch_search_ready' ) ) { fwrite( STDERR, "Search index is unavailable.\n" ); exit( 1 ); }
global $wpdb;
$documents = CH_Indexed_Search::table( 'documents' );
$counts = $wpdb->get_row( "SELECT COUNT(*) AS total,SUM(price_valid=1 AND has_paid_option=1) AS paid,SUM(price_valid=1 AND has_free_option=1 AND has_paid_option=0) AS free_only,SUM(price_valid=1 AND has_free_option=1 AND has_paid_option=1) AS mixed,SUM(price_valid=0) AS invalid FROM $documents", ARRAY_A );
if ( (int) $counts['total'] !== (int) $counts['paid'] + (int) $counts['free_only'] + (int) $counts['mixed'] + (int) $counts['invalid'] ) { fwrite( STDERR, "Pricing classifications do not cover the document index.\n" ); exit( 1 ); }

function ch_test_search( $availability, $page ) {
	$request = new WP_REST_Request( 'GET', '/ch/v1/indexed-search' );
	foreach ( array( 'q' => '', 'page' => $page, 'per_page' => 24, 'sort' => 'best-selling', 'avail' => $availability ) as $key => $value ) { $request->set_param( $key, $value ); }
	return rest_do_request( $request );
}

function ch_test_collection( $availability, $expected_total, $count_key ) {
	global $wpdb, $documents;
	$first = ch_test_search( $availability, 1 );
	$second = ch_test_search( $availability, 2 );
	foreach ( array( $first, $second ) as $response ) { if ( is_wp_error( $response ) || $response->get_status() !== 200 ) { fwrite( STDERR, "Search failed for $availability.\n" ); exit( 1 ); } }
	$data = $first->get_data();
	$other = $second->get_data();
	if ( (int) $data['pagination']['total'] !== $expected_total || (int) $data['pagination']['total_pages'] !== (int) ceil( $expected_total / 24 ) ) { fwrite( STDERR, "Unexpected $availability total or page count.\n" ); exit( 1 ); }
	$cards = array_merge( $data['data'], $other['data'] );
	$ids = array_map( static function( $card ) { return (int) $card['id']; }, $cards );
	if ( count( array_unique( $ids ) ) !== count( $ids ) ) { fwrite( STDERR, "Pagination repeated a $availability result.\n" ); exit( 1 ); }
	foreach ( $cards as $card ) {
		$class = $card['price']['class'] ?? '';
		if ( 'paid' === $availability && ( ! in_array( $class, array( 'paid', 'mixed' ), true ) || (float) $card['price']['amount'] <= 0 ) ) { fwrite( STDERR, "Paid results include a non-paid item or zero card price.\n" ); exit( 1 ); }
		if ( 'free' === $availability && ( 'free' !== $class || (float) $card['price']['amount'] !== 0.0 ) ) { fwrite( STDERR, "Free results include a paid, mixed, or invalid item.\n" ); exit( 1 ); }
	}
	$id_list = implode( ',', array_map( 'absint', $ids ) );
	$sales_rows = $wpdb->get_results( "SELECT product_id,sales FROM $documents WHERE product_id IN ($id_list)", ARRAY_A );
	$sales = array(); foreach ( $sales_rows as $row ) { $sales[ (int) $row['product_id'] ] = (int) $row['sales']; }
	$previous = PHP_INT_MAX;
	foreach ( $ids as $id ) { if ( $sales[ $id ] > $previous ) { fwrite( STDERR, "Best-selling order is not descending.\n" ); exit( 1 ); } $previous = $sales[ $id ]; }
	return array( 'total' => (int) $data['pagination']['total'], 'pages' => (int) $data['pagination']['total_pages'], 'sampled_rows' => count( $ids ) );
}

$paid = ch_test_collection( 'paid', (int) $counts['paid'], 'paid' );
$free = ch_test_collection( 'free', (int) $counts['free_only'], 'free_only' );
echo wp_json_encode( array( 'pricing' => array_map( 'intval', $counts ), 'paid' => $paid, 'free_only' => $free, 'status' => 'PASS: paid/free classification, invalid exclusion, pagination, and sales ranking' ), JSON_PRETTY_PRINT ) . PHP_EOL;
