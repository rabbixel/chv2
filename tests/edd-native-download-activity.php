<?php
/** Execute installed EDD functions with in-memory dependencies; no WP, DB, or AWS access. */
$root = $argv[1] ?? 'C:/laragon/www/creativehatti/wp-content/plugins/easy-digital-downloads/includes';
function load_native( $path, $names ) {
    $source = file_get_contents( $path );
    foreach ( $names as $name ) {
        if ( ! preg_match( '/^function ' . preg_quote( $name, '/' ) . '\(.*?^\}/ms', $source, $match ) ) {
            throw new RuntimeException( 'Missing native function: ' . $name );
        }
        eval( $match[0] );
    }
    return $source;
}
function apply_filters( $name, $value, ...$args ) { return $value; }
function wp_salt( $scheme = '' ) { return 'isolated-test-only-' . $scheme; }
function wp_parse_url( $url ) { return parse_url( $url ); }
function wp_parse_str( $query, &$args ) { parse_str( $query, $args ); }
function current_time( $kind ) { return time(); }
function esc_html__( $text, $domain ) { return $text; }
function wp_die( ...$args ) { throw new RuntimeException( 'expired' ); }
function site_url() { return 'https://example.test'; }
function add_query_arg( $args, $url = null ) {
    $url = $url ?? $GLOBALS['request_url'];
    $parts = parse_url( $url );
    parse_str( $parts['query'] ?? '', $query );
    foreach ( $args as $key => $value ) {
        if ( false === $value ) { unset( $query[$key] ); } else { $query[$key] = $value; }
    }
    return strtok( $url, '?' ) . '?' . http_build_query( $query );
}
function absint( $value ) { return abs( (int) $value ); }
function sanitize_text_field( $value ) { return $value; }
function edd_get_order( $id ) { return $GLOBALS['orders'][$id]; }
function edd_get_file_download_limit( $id ) { return $GLOBALS['limit']; }
function edd_payment_has_unlimited_downloads( $id ) { return false; }
function edd_get_file_download_limit_override( $product, $order ) { return 0; }
function edd_count_file_download_logs( $args ) {
    return count( array_filter( $GLOBALS['logs'], static function ( $log ) use ( $args ) {
        foreach ( $args as $key => $value ) { if ( $log[$key] != $value ) { return false; } }
        return true;
    } ) );
}
function edd_die_file_download_limit_reached() { throw new RuntimeException( 'limit' ); }
function edd_order_grants_access_to_download_files( $args ) {
    $GLOBALS['entitlement_args'] = $args;
    return $GLOBALS['entitled'];
}
function edd_get_download_files( $id ) { return array( 1 => array( 'name' => 'test.zip' ) ); }
function edd_get_file_name( $file ) { return $file['name']; }
function edd_add_file_download_log( $args ) { $GLOBALS['logs'][] = $args; return count( $GLOBALS['logs'] ); }
function edd_add_file_download_log_meta( $id, $key, $value ) { $GLOBALS['meta'][$id][$key] = $value; }
function check( $condition, $message ) {
    if ( ! $condition ) { throw new RuntimeException( $message ); }
    ++$GLOBALS['assertions'];
}
$GLOBALS['assertions'] = 0;
$GLOBALS['logs'] = array();
$GLOBALS['limit'] = 0;
$GLOBALS['entitled'] = true;
load_native( "$root/download-functions.php", array( 'edd_get_download_token', 'edd_validate_url_token', 'edd_get_url_token_parameters', 'edd_is_file_at_download_limit', 'edd_record_download_in_log' ) );
$process = load_native( "$root/process-download.php", array( 'edd_process_signed_download_url' ) );
check( strpos( $process, "if ( \$args['payment'] && \$args['has_access'] )" ) < strpos( $process, '$log_id = edd_record_download_in_log' ), 'native logging is inside access gate' );
check( strpos( $process, '$log_id = edd_record_download_in_log' ) < strpos( $process, 'edd_delete_file_download_log( $log_id )' ), 'native race-limit rejection removes claimed log' );
foreach ( array( 501 => 0, 502 => 100 ) as $id => $total ) {
    $GLOBALS['orders'][$id] = (object) array( 'id' => $id, 'type' => 'sale', 'total' => $total, 'customer_id' => $id + 10, 'email' => 'test@example.test', 'payment_key' => 'synthetic' );
    $_GET = array( 'eddfile' => "$id:123:1", 'ttl' => time() + 100 );
    $url = add_query_arg( $_GET, site_url() );
    $GLOBALS['request_url'] = add_query_arg( array( 'token' => edd_get_download_token( $url ) ), $url );
    for ( $i = 0; $i < 2; ++$i ) {
        $args = edd_process_signed_download_url( array() );
        check( $args['has_access'] && (int) $args['payment'] === $id, 'free/paid repeat authorization' );
        check( (int) $GLOBALS['entitlement_args']['product_id'] === 123 && $GLOBALS['entitlement_args']['price_id'] === null, 'exact product and price authorization' );
        edd_record_download_in_log( 123, 1, array(), '127.0.0.1', $args['payment'], $args['price_id'], 'test-agent' );
    }
    $last = end( $GLOBALS['logs'] );
    check( $last['order_id'] === $id && $last['customer_id'] === $id + 10 && $last['product_id'] === 123 && $last['file_id'] === 1, 'native log associations' );
    check( $GLOBALS['meta'][count( $GLOBALS['logs'] )]['file_name'] === 'test.zip', 'native filename metadata' );
    $before = count( $GLOBALS['logs'] );
    $GLOBALS['entitled'] = false;
    check( ! edd_process_signed_download_url( array() )['has_access'], 'unauthorized denied' );
    $GLOBALS['entitled'] = true;
    $GLOBALS['limit'] = 2;
    try { edd_process_signed_download_url( array() ); throw new LogicException( 'limit allowed' ); }
    catch ( RuntimeException $error ) { check( $error->getMessage() === 'limit', 'repeat limit enforced' ); }
    $GLOBALS['limit'] = 0;
    $GLOBALS['request_url'] = add_query_arg( array( 'token' => 'invalid' ), $url );
    check( ! edd_process_signed_download_url( array() )['has_access'], 'tampered token denied' );
    $GLOBALS['request_url'] = add_query_arg( array( 'ttl' => time() - 1 ), $url );
    try { edd_process_signed_download_url( array() ); throw new LogicException( 'expiry allowed' ); }
    catch ( RuntimeException $error ) { check( $error->getMessage() === 'expired', 'expired denied' ); }
    check( count( $GLOBALS['logs'] ) === $before, 'authorization checks do not add logs' );
}
echo 'PASS: ' . $GLOBALS['assertions'] . " installed EDD activity assertions (in-memory dependencies)\n";
