<?php
/** Read-only local audit. No URL redemption, signing, orders, or log writes. */
if ( PHP_SAPI !== 'cli' ) { exit( 1 ); }
$root = $argv[1] ?? 'C:/laragon/www/creativehatti';
$_SERVER['REQUEST_SCHEME'] = 'http';
$_SERVER['HTTP_HOST'] = 'creativehatti.test';
require rtrim( $root, '/\\' ) . '/wp-load.php';
global $wpdb;
$logs = $wpdb->prefix . 'edd_logs_file_downloads';
$orders = $wpdb->prefix . 'edd_orders';
$items = $wpdb->prefix . 'edd_order_items';
$active = (array) get_option( 'active_plugins', array() );
$result = array(
    'edd_version' => defined( 'EDD_VERSION' ) ? EDD_VERSION : null,
    's3_version' => defined( 'EDD_AS3_VERSION' ) ? EDD_AS3_VERSION : null,
    's3_active' => (bool) array_filter( $active, static function ( $plugin ) { return str_starts_with( $plugin, 'edd-amazon-s3/' ); } ),
    'native_log_callback' => has_action( 'init', 'edd_process_download' ),
    'require_login_to_download' => (bool) edd_get_option( 'require_login_to_download', false ),
    'disable_guest_checkout' => (bool) edd_get_option( 'logged_in_only', false ),
    'global_download_limit' => (int) edd_get_option( 'file_download_limit', 0 ),
    'log_columns' => $wpdb->get_col( "SHOW COLUMNS FROM $logs" ),
    'activity_by_order_kind' => $wpdb->get_results(
        "SELECT CASE WHEN o.total = 0 THEN 'free' ELSE 'paid' END AS kind,
         COUNT(*) AS logs, COUNT(DISTINCT l.order_id) AS orders,
         SUM(o.user_id = 0) AS guest_logs,
         SUM(l.customer_id = o.customer_id) AS matching_customer_logs
         FROM $logs l INNER JOIN $orders o ON o.id = l.order_id
         WHERE o.type = 'sale' GROUP BY kind", ARRAY_A ),
    'recent_associations' => $wpdb->get_results(
        "SELECT l.id AS log_id, l.product_id, l.file_id, l.order_id, l.price_id,
         l.date_created, o.status AS order_status,
         CASE WHEN o.total = 0 THEN 'free' ELSE 'paid' END AS kind,
         (o.user_id = 0) AS guest, (l.customer_id = o.customer_id) AS customer_matches,
         EXISTS(SELECT 1 FROM $items i WHERE i.order_id = l.order_id
           AND i.product_id = l.product_id AND COALESCE(i.price_id, 0) = l.price_id) AS item_matches
         FROM $logs l INNER JOIN $orders o ON o.id = l.order_id
         WHERE o.type = 'sale' ORDER BY l.id DESC LIMIT 12", ARRAY_A ),
);
if ( $wpdb->last_error ) { fwrite( STDERR, "Audit query failed.\n" ); exit( 1 ); }
echo wp_json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ), PHP_EOL;
