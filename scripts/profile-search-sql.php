<?php
/** Bounded, read-only profile of the real local indexed-search REST handler. */
if ( PHP_SAPI !== 'cli' ) { exit( 1 ); }
define( 'SAVEQUERIES', true );
$profile_flags = array( '--explain', '--tokens-first', '--facets-first', '--brief' );
$wp_root_args = array_values( array_filter( array_slice( $argv, 2 ), static function ( $arg ) use ( $profile_flags ) { return ! in_array( $arg, $profile_flags, true ); } ) );
$wp_root = $wp_root_args[0] ?? getenv( 'CH_LOCAL_WP_ROOT' );
if ( ! $wp_root || ! is_file( rtrim( $wp_root, '/\\' ) . '/wp-config.php' ) ) {
	fwrite( STDERR, "Pass the local WordPress root as argument 2 or CH_LOCAL_WP_ROOT.\n" );
	exit( 2 );
}
$_SERVER['REQUEST_SCHEME'] = 'http';
$_SERVER['HTTP_HOST'] = 'creativehatti.test';
$_SERVER['SERVER_PORT'] = '80';
require rtrim( $wp_root, '/\\' ) . '/wp-config.php';

$host = strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) );
$db_host = strtolower( (string) preg_replace( '/:\\d+$/', '', DB_HOST ) );
if ( ! in_array( $host, array( 'creativehatti.test', 'localhost', '127.0.0.1' ), true ) || ! in_array( $db_host, array( 'localhost', '127.0.0.1', '::1' ), true ) ) {
	fwrite( STDERR, "Refusing non-local WordPress or database host.\n" );
	exit( 2 );
}

global $wpdb;
$scenario = $argv[1] ?? 'vector';
$params = array( 'q' => $scenario, 'page' => 1, 'per_page' => 24, 'sort' => 'relevance', 'orientation' => 'all', 'avail' => null, 'min' => null, 'max' => null, 'cat' => null, 'group' => null, 'file' => null, 'app' => null, 'license' => null, 'collection' => null, 'sale' => false, 'rating' => 0 );
if ( 'zero' === $scenario ) { $params['q'] = 'ch-profile-zero-match-zzqv'; }
if ( 'paid' === $scenario ) { $params = array_merge( $params, array( 'q' => 'vector', 'avail' => 'paid' ) ); }
if ( 'combined' === $scenario ) { $params = array_merge( $params, array( 'q' => 'diwali', 'cat' => 'social-media', 'orientation' => 'landscape', 'avail' => 'paid', 'sort' => 'price-asc' ) ); }
$query_plans = array();
$candidate_changes = array( 'tokens_first' => in_array( '--tokens-first', $argv, true ), 'facets_first' => in_array( '--facets-first', $argv, true ) );
$capture_explain = in_array( '--explain', $argv, true );
if ( $capture_explain || $candidate_changes['tokens_first'] || $candidate_changes['facets_first'] ) {
	$inside_explain = false;
	add_filter( 'query', static function ( $sql ) use ( &$inside_explain, &$query_plans, $candidate_changes, $capture_explain, $wpdb ) {
		$trimmed = ltrim( $sql );
		$match_prefix = 'INSERT INTO ' . $wpdb->prefix . 'ch_search_matches SELECT ';
		$kind = null;
		$explain_sql = null;
		if ( str_starts_with( $trimmed, $match_prefix ) ) {
			$kind = 'match_materialization';
			$explain_sql = substr( $trimmed, strpos( $trimmed, 'SELECT ' ) );
			if ( $candidate_changes['tokens_first'] && false === strpos( $trimmed, ') t1 ON ' ) ) {
				$derived_start = strpos( $trimmed, 'JOIN (SELECT product_id, MAX(weight) AS score FROM ' );
				$derived_end = false === $derived_start ? false : strpos( $trimmed, ' ON t0.product_id=d.product_id ', $derived_start );
				$where_start = false === $derived_end ? false : strpos( $trimmed, 'WHERE ', $derived_end );
				if ( false !== $derived_start && false !== $derived_end && false !== $where_start ) {
					$target = substr( $trimmed, 0, strpos( $trimmed, 'SELECT ' ) );
					$derived = substr( $trimmed, $derived_start + strlen( 'JOIN ' ), $derived_end - $derived_start - strlen( 'JOIN ' ) );
					$where = substr( $trimmed, $where_start );
					$trimmed = $target . 'SELECT d.product_id,(t0.score) FROM ' . $derived . ' STRAIGHT_JOIN ' . $wpdb->prefix . 'ch_search_documents d ON d.product_id=t0.product_id STRAIGHT_JOIN ' . $wpdb->posts . ' p ON p.ID=d.product_id ' . $where;
					$explain_sql = substr( $trimmed, strpos( $trimmed, 'SELECT ' ) );
				}
			}
		} elseif ( str_starts_with( $trimmed, 'SELECT f.kind,f.value,MAX(f.label) AS label,COUNT(*) AS count' ) ) {
			$kind = 'facet_aggregation';
			if ( $candidate_changes['facets_first'] ) {
				$matches_table = $wpdb->prefix . 'ch_search_matches';
				$facets_table = $wpdb->prefix . 'ch_search_facets';
				$trimmed = str_replace( 'FROM ' . $matches_table . ' m JOIN ' . $facets_table . ' f ON f.product_id=m.product_id', 'FROM ' . $facets_table . ' f STRAIGHT_JOIN ' . $matches_table . ' m ON f.product_id=m.product_id', $trimmed );
			}
			$explain_sql = $trimmed;
		} elseif ( str_starts_with( $trimmed, 'SELECT d.card,page.relevance FROM (' ) ) {
			$kind = 'page_selection';
			$explain_sql = $trimmed;
		}
		if ( $capture_explain && ! $inside_explain && $kind && $explain_sql ) {
			$inside_explain = true;
			$plan = $wpdb->get_var( 'EXPLAIN FORMAT=JSON ' . $explain_sql );
			$query_plans[ $kind ] = is_string( $plan ) ? json_decode( $plan, true ) : null;
			$inside_explain = false;
		}
		return $trimmed;
	} );
}
$request = new WP_REST_Request( 'GET', '/ch/v1/indexed-search' );
foreach ( $params as $key => $value ) { if ( null !== $value ) { $request->set_param( $key, $value ); } }
$response = rest_do_request( $request );
$data = rest_get_server()->response_to_data( $response, false );
$queries = $wpdb->queries ?? array();
$query_times = array( 'match_materialization_ms' => null, 'facet_aggregation_ms' => null, 'page_selection_ms' => null, 'total_count_ms' => null );
foreach ( $queries as $query ) {
	$sql = ltrim( $query[0] );
	if ( str_starts_with( $sql, 'INSERT INTO ' . $wpdb->prefix . 'ch_search_matches SELECT ' ) ) { $query_times['match_materialization_ms'] = round( $query[1] * 1000, 2 ); }
	if ( str_starts_with( $sql, 'SELECT f.kind,f.value,MAX(f.label) AS label,COUNT(*) AS count' ) ) { $query_times['facet_aggregation_ms'] = round( $query[1] * 1000, 2 ); }
	if ( str_starts_with( $sql, 'SELECT d.card,page.relevance FROM (' ) ) { $query_times['page_selection_ms'] = round( $query[1] * 1000, 2 ); }
	if ( str_starts_with( $sql, 'SELECT COUNT(*) FROM ' . $wpdb->prefix . 'ch_search_matches' ) ) { $query_times['total_count_ms'] = round( $query[1] * 1000, 2 ); }
}
$plan_summary = array();
$summarize_plan = static function ( $node, &$tables, &$operations ) use ( &$summarize_plan ) {
	if ( ! is_array( $node ) ) { return; }
	if ( isset( $node['table'] ) && is_array( $node['table'] ) ) {
		$table = $node['table'];
		$tables[] = array_intersect_key( $table, array_flip( array( 'table_name', 'access_type', 'key', 'used_key_parts', 'rows_examined_per_scan', 'rows_produced_per_join', 'filtered', 'using_index', 'data_read_per_join' ) ) );
	}
	foreach ( $node as $key => $value ) {
		if ( 'ordering_operation' === $key && is_array( $value ) ) { $operations[] = array_intersect_key( $value, array_flip( array( 'using_temporary_table', 'using_filesort' ) ) ); }
		if ( is_array( $value ) ) { $summarize_plan( $value, $tables, $operations ); }
	}
};
foreach ( $query_plans as $kind => $plan ) {
	$tables = array();
	$operations = array();
	$summarize_plan( $plan, $tables, $operations );
	$plan_summary[ $kind ] = array( 'query_cost' => $plan['query_block']['cost_info']['query_cost'] ?? null, 'tables' => $tables, 'ordering_operations' => $operations );
}
usort( $queries, static function ( $left, $right ) { return $right[1] <=> $left[1]; } );
$summary = array(
	'host' => $host,
	'db_host' => $db_host,
	'http_status' => $response->get_status(),
	'result_count' => $data['pagination']['total'] ?? null,
	'handler_ms' => $data['took_ms'] ?? null,
	'query_count' => count( $queries ),
	'db_ms' => round( array_sum( array_column( $queries, 1 ) ) * 1000, 2 ),
	'query_times_ms' => $query_times,
	'query_plans' => $plan_summary,
	'slowest_queries' => in_array( '--brief', $argv, true ) ? array() : array_map( static function ( $query ) { return array( 'ms' => round( $query[1] * 1000, 2 ), 'sql' => preg_replace( '/\s+/', ' ', $query[0] ) ); }, array_slice( $queries, 0, 8 ) ),
);
echo wp_json_encode( $summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
