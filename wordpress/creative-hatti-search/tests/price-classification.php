<?php
// Offline regression tests for EDD price extraction and collection predicates.
define( 'ABSPATH', __DIR__ . DIRECTORY_SEPARATOR );
function add_action( ...$args ) {}
function register_activation_hook( ...$args ) {}
$GLOBALS['ch_test_prices'] = array();
function edd_has_variable_prices( $id ) { return ! empty( $GLOBALS['ch_test_prices'][ $id ]['variable'] ); }
function edd_get_variable_prices( $id ) { return $GLOBALS['ch_test_prices'][ $id ]['options'] ?? false; }
function metadata_exists( $type, $id, $key ) { return array_key_exists( 'fixed', $GLOBALS['ch_test_prices'][ $id ] ?? array() ); }
function get_post_meta( $id, $key, $single = false ) { return $GLOBALS['ch_test_prices'][ $id ]['fixed'] ?? ''; }
function edd_get_download_price( $id ) { return $GLOBALS['ch_test_prices'][ $id ]['fixed'] ?? false; }
require dirname( __DIR__ ) . '/creative-hatti-search.php';

$fixtures = array(
	1 => array( 'fixed' => '49' ),
	2 => array( 'fixed' => '0' ),
	3 => array( 'variable' => true, 'options' => array( array( 'amount' => '25' ), array( 'amount' => 80 ) ) ),
	4 => array( 'variable' => true, 'options' => array( array( 'amount' => '0' ), array( 'amount' => '25' ) ) ),
	5 => array( 'variable' => true, 'options' => array() ),
	6 => array( 'variable' => true, 'options' => array( array( 'amount' => '' ), array( 'amount' => 'bad' ), array( 'amount' => '-1' ), array( 'amount' => INF ), array( 'amount' => NAN ) ) ),
	7 => array( 'variable' => true, 'options' => array( array( 'amount' => '0' ), array( 'amount' => 'bad' ) ) ),
	8 => array( 'fixed' => '' ),
	9 => array( 'fixed' => '-2' ),
);
$GLOBALS['ch_test_prices'] = $fixtures;
$expected = array( 1 => 'paid', 2 => 'free', 3 => 'paid', 4 => 'mixed', 5 => 'invalid', 6 => 'invalid', 7 => 'free', 8 => 'invalid', 9 => 'invalid' );
foreach ( $expected as $id => $class ) {
	$actual = CH_Indexed_Search::product_price_classification( $id );
	if ( $actual['class'] !== $class ) { fwrite( STDERR, "Fixture $id expected $class, got {$actual['class']}\n" ); exit( 1 ); }
}
$mixed = CH_Indexed_Search::product_price_classification( 4 );
if ( 0.0 !== $mixed['minimum'] || 25.0 !== $mixed['display'] || ! $mixed['has_free'] || ! $mixed['has_paid'] ) { fwrite( STDERR, "Mixed-price card pricing is incorrect.\n" ); exit( 1 ); }
if ( CH_Indexed_Search::availability_condition( 'paid' ) !== 'd.price_valid=1 AND d.has_paid_option=1' ) { exit( 1 ); }
if ( CH_Indexed_Search::availability_condition( 'free' ) !== 'd.price_valid=1 AND d.has_free_option=1 AND d.has_paid_option=0' ) { exit( 1 ); }
if ( CH_Indexed_Search::availability_condition( '' ) !== '' ) { exit( 1 ); }
echo 'PASS: 9 fixed/variable/mixed/missing/invalid fixtures and collection predicates.' . PHP_EOL;
