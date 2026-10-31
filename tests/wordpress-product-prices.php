<?php
/** Isolated tests of API price DTOs, including EDD's missing-price normalization. */
define( 'ABSPATH', __DIR__ );
class CH_Media {}
function edd_get_currency() { return 'INR'; }
function edd_has_variable_prices( $id ) { return $GLOBALS['variable']; }
function edd_get_variable_prices( $id ) { return $GLOBALS['prices']; }
function get_post_meta( $id, $key, $single ) { return 'edd_price' === $key ? $GLOBALS['stored'] : ( $GLOBALS['stale_options'] ?? '' ); }
function edd_get_download_price( $id ) { return $GLOBALS['normalized']; }
function metadata_exists( $type, $id, $key ) { return $GLOBALS['price_meta_exists']; }
function number_format_i18n( $amount, $decimals ) { return number_format( $amount, $decimals ); }
function sanitize_text_field( $value ) { return $value; }
function wp_list_pluck( $rows, $key ) { return array_column( $rows, $key ); }
function check( $condition, $message ) { if ( ! $condition ) { throw new RuntimeException( $message ); } }
require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-product-transformer.php';
$transformer = new CH_Product_Transformer( new CH_Media() );
$GLOBALS['variable'] = false;
$GLOBALS['price_meta_exists'] = true;
foreach ( array( null, '', 'bad', -1, INF ) as $invalid ) {
    $GLOBALS['stored'] = $invalid;
    $GLOBALS['normalized'] = 0;
    check( null === $transformer->price( 1 )['amount'], 'invalid fixed metadata must not become free' );
}
$GLOBALS['price_meta_exists'] = false;
$GLOBALS['stored'] = '';
$GLOBALS['normalized'] = 0;
$GLOBALS['stale_options'] = '';
$missing = $transformer->price( 1 );
check( 0.0 === $missing['amount'] && 'free' === $missing['class'] && true === $missing['valid'], 'missing fixed metadata follows EDD zero-price behavior' );
check( 'free' === $transformer->price( 1, false )['class'] && 0.0 === $transformer->price( 1, false )['amount'], 'list and detail fixed-price classification agrees' );
$GLOBALS['stale_options'] = array( array( 'amount' => 25 ) );
check( 'invalid' === $transformer->price( 1 )['class'], 'stale variable options make missing fixed metadata ambiguous' );
$GLOBALS['stale_options'] = '';
$GLOBALS['price_meta_exists'] = true;
foreach ( array( 0, '0.00', 25 ) as $valid ) {
    $GLOBALS['stored'] = $valid;
    $GLOBALS['normalized'] = $valid;
    check( (float) $valid === $transformer->price( 1 )['amount'], 'explicit fixed price retained' );
}
$GLOBALS['variable'] = true;
foreach ( array( 'free' => array( 0, '0' ), 'paid' => array( 25, 50 ), 'mixed' => array( 0, 50 ), 'invalid' => array( null, -1 ) ) as $expected => $amounts ) {
    $GLOBALS['prices'] = array( 0 => array( 'name' => 'First', 'amount' => $amounts[0] ), 2 => array( 'name' => 'Second', 'amount' => $amounts[1] ) );
    check( $expected === $transformer->price( 1, false )['class'], 'list classification uses all valid EDD options' );
    check( array( 0, 2 ) === array_column( $transformer->price( 1 )['options'], 'id' ), 'actual EDD option keys retained' );
}
$GLOBALS['prices'] = array( 0 => array( 'name' => 'Free', 'amount' => 0 ), 1 => array( 'name' => 'Paid', 'amount' => 50 ) );
$list_mixed = $transformer->price( 1, false );
$detail_mixed = $transformer->price( 1, true );
check( 'mixed' === $list_mixed['class'] && $list_mixed['amount'] === $detail_mixed['amount'], 'variable list and detail price classification agrees' );
echo "Product price DTO tests passed.\n";
