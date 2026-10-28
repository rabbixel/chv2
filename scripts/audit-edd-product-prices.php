<?php
/** Read-only local EDD price comparison; never creates orders or redeems links. */
if ( PHP_SAPI !== 'cli' ) { exit( 1 ); }
$_SERVER['REQUEST_SCHEME'] = 'http';
$_SERVER['HTTP_HOST'] = 'creativehatti.test';
require ( $argv[1] ?? 'C:/laragon/www/creativehatti' ) . '/wp-load.php';
global $wpdb;
$found = array();
$transformer = new CH_Product_Transformer( new CH_Media() );
for ( $offset = 0; ; $offset += 500 ) {
    $ids = $wpdb->get_col( $wpdb->prepare( "SELECT p.ID FROM {$wpdb->posts} p WHERE p.post_type = 'download' AND p.post_status = 'publish'
        AND (p.ID IN (2858, 12347, 2499) OR p.post_title LIKE '%%Bharti Singh%%'
          OR EXISTS(SELECT 1 FROM {$wpdb->postmeta} m WHERE m.post_id = p.ID AND m.meta_key = '_variable_pricing' AND m.meta_value = '1'))
        ORDER BY p.ID LIMIT 500 OFFSET %d", $offset ) );
    if ( ! $ids ) { break; }
    foreach ( $ids as $id ) {
        $variable = edd_has_variable_prices( $id );
        $raw = $variable ? edd_get_variable_prices( $id ) : array();
        $amounts = $variable ? array_column( (array) $raw, 'amount' ) : array( edd_get_download_price( $id ) );
        $valid = array_filter( $amounts, static function ( $value ) { return is_numeric( $value ) && is_finite( (float) $value ) && $value >= 0; } );
        $kind = ! $valid ? 'invalid' : ( max( $valid ) == 0 ? 'free' : ( min( $valid ) == 0 ? 'mixed' : 'paid' ) );
        $key = ( $variable ? 'variable_' : 'fixed_' ) . $kind;
        $title = get_the_title( $id );
        if ( stripos( $title, 'Bharti Singh' ) !== false ) { $key = 'bharti'; }
        if ( ! isset( $found[$key] ) ) {
            $found[$key] = array( 'id' => (int) $id, 'title' => $title, 'variable' => (bool) $variable, 'edd_amounts' => $amounts, 'api_price' => $transformer->price( $id ), 'api_variable_prices' => $transformer->variable_prices( $id ) );
        }
    }
    wp_cache_flush_runtime();
}
echo wp_json_encode( $found, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ), PHP_EOL;
