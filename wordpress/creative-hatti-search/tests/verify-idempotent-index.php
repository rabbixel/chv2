<?php
// Re-index one existing public document twice and confirm derived rows stay identical.
if ( PHP_SAPI !== 'cli' ) { exit( 2 ); }
$path = $argv[1] ?? '';
if ( ! $path || ! is_file( $path . '/wp-load.php' ) ) { fwrite( STDERR, "Usage: verify-idempotent-index.php WORDPRESS_ROOT\n" ); exit( 2 ); }
$_SERVER['REQUEST_SCHEME'] = 'http';
$_SERVER['HTTP_HOST'] = 'creativehatti.test';
require $path . '/wp-load.php';
if ( ! class_exists( 'CH_Indexed_Search' ) ) { fwrite( STDERR, "Search plugin is not active.\n" ); exit( 1 ); }
global $wpdb;
$documents = CH_Indexed_Search::table( 'documents' );
$tokens = CH_Indexed_Search::table( 'tokens' );
$facets = CH_Indexed_Search::table( 'facets' );
$id = (int) $wpdb->get_var( "SELECT product_id FROM $documents ORDER BY product_id ASC LIMIT 1" );
if ( ! $id ) { fwrite( STDERR, "No indexed product is available.\n" ); exit( 1 ); }
$snapshot = static function() use ( $wpdb, $documents, $tokens, $facets, $id ) {
	$document = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $documents WHERE product_id=%d", $id ), ARRAY_A );
	$token_rows = $wpdb->get_results( $wpdb->prepare( "SELECT word,product_id,weight FROM $tokens WHERE product_id=%d ORDER BY word", $id ), ARRAY_A );
	$facet_rows = $wpdb->get_results( $wpdb->prepare( "SELECT kind,value,product_id,label FROM $facets WHERE product_id=%d ORDER BY kind,value", $id ), ARRAY_A );
	return hash( 'sha256', wp_json_encode( array( $document, $token_rows, $facet_rows ), JSON_UNESCAPED_SLASHES ) );
};
$before = $snapshot();
for ( $i = 0; $i < 2; $i++ ) {
	$result = CH_Indexed_Search::index_product( $id );
	if ( is_wp_error( $result ) ) { fwrite( STDERR, $result->get_error_message() . "\n" ); exit( 1 ); }
	if ( $snapshot() !== $before ) { fwrite( STDERR, "Derived rows changed after repeat indexing of product $id.\n" ); exit( 1 ); }
}
echo "PASS: product $id document, tokens, and facets are unchanged after two repeated indexing passes." . PHP_EOL;
