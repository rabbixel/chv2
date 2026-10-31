<?php
// Offline regression tests for the indexed preview-image orientation rules.
define( 'ABSPATH', __DIR__ . DIRECTORY_SEPARATOR );
function add_action( ...$args ) {}
function register_activation_hook( ...$args ) {}
require dirname( __DIR__ ) . '/creative-hatti-search.php';

$fixtures = array(
	array( 300, 200, 'landscape' ),
	array( 211, 200, 'landscape' ), // 1.055 is above the landscape threshold.
	array( 21, 20, 'square' ),
	array( 19, 20, 'square' ),
	array( 18, 20, 'portrait' ),
	array( 0, 20, null ),
	array( -1, 20, null ),
	array( 300, 0, null ),
	array( 'invalid', 20, null ),
	array( INF, 20, null ),
	array( NAN, 20, null ),
);
foreach ( $fixtures as $fixture ) {
	$actual = CH_Indexed_Search::orientation_from_dimensions( $fixture[0], $fixture[1] );
	if ( $actual !== $fixture[2] ) { fwrite( STDERR, sprintf( "Expected %s for %s x %s, received %s.\n", var_export( $fixture[2], true ), $fixture[0], $fixture[1], var_export( $actual, true ) ) ); exit( 1 ); }
}
echo 'PASS: landscape, portrait, inclusive square boundaries, invalid and missing dimensions.' . PHP_EOL;
