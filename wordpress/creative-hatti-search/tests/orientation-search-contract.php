<?php
// Source-level contract checks for orientation filtering and the bounded refresh command.
$source = file_get_contents( dirname( __DIR__ ) . '/creative-hatti-search.php' );
$filter_position = strpos( $source, "if ( 'all' !== \$request['orientation'] )" );
$materialize_position = strpos( $source, 'CREATE TEMPORARY TABLE $matches' );
$checks = array(
	'orientation REST enum' => false !== strpos( $source, "'orientation' => array( 'type' => 'string', 'default' => 'all', 'enum' => array( 'all', 'landscape', 'portrait', 'square' ) )" ),
	'orientation facet applied before materialized pagination' => false !== $filter_position && false !== $materialize_position && $filter_position < $materialize_position && false !== strpos( $source, "facet_condition( 'orientation', array( \$request['orientation'] ) )" ),
	'bounded orientation-only refresh command' => false !== strpos( $source, "'ch-search orientation-backfill'" ) && false !== strpos( $source, "'orientation' => array" ) && false !== strpos( $source, "kind='orientation'" ),
	'local target guard' => false !== strpos( $source, 'Orientation backfill is restricted to a local WordPress site and local database.' ),
);
foreach ( $checks as $label => $passed ) {
	if ( ! $passed ) { fwrite( STDERR, "FAIL: $label\n" ); exit( 1 ); }
}
echo 'PASS: orientation API, pre-pagination facet filtering and bounded local-only orientation backfill contract.' . PHP_EOL;
