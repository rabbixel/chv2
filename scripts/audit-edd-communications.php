<?php
/** Read-only local audit. No sends, hooks replay, customer reads, or key output. */
if ( PHP_SAPI !== 'cli' ) { exit( 1 ); }
$_SERVER['REQUEST_SCHEME'] = 'http'; $_SERVER['HTTP_HOST'] = 'creativehatti.test';
require ( $argv[1] ?? 'C:/laragon/www/creativehatti' ) . '/wp-load.php';
global $wpdb;
$result = array( 'environment' => wp_get_environment_type(), 'edd_version' => EDD_VERSION,
    'store_name' => get_bloginfo( 'name' ),
    'local_mailpit_hook' => file_exists( WPMU_PLUGIN_DIR . '/creative-hatti-local-mailpit.php' ),
    'emails' => array(),
    'receipt_hook_present' => has_action( 'edd_complete_purchase', 'edd_trigger_purchase_receipt' ),
    'after_order_hook_present' => has_action( 'edd_after_order_actions' ),
);
foreach ( array( 'order_receipt', 'admin_order_notice', 'order_refund', 'admin_order_refund' ) as $id ) {
    $email = edd_get_email_by( 'email_id', $id );
    $result['emails'][$id] = $email ? array( 'enabled' => $email->is_enabled(), 'subject' => $email->subject,
        'content_tags' => preg_match_all( '/\{[a-z_]+\}/', (string) $email->content, $tags ) ? $tags[0] : array() ) : null;
}
$items = $wpdb->prefix . 'edd_order_items';
$itemmeta = $wpdb->prefix . 'edd_order_itemmeta';
$result['order_item_columns'] = $wpdb->get_col( "SHOW COLUMNS FROM $items" );
$result['item_meta_keys'] = $wpdb->get_results( "SELECT meta_key, COUNT(*) AS records FROM $itemmeta GROUP BY meta_key ORDER BY records DESC LIMIT 20", ARRAY_A );
$result['variable_purchased_items'] = $wpdb->get_results( "SELECT id, order_id, product_id, product_name, price_id FROM $items WHERE price_id IS NOT NULL ORDER BY id DESC LIMIT 8", ARRAY_A );
$result['software_license_counts'] = $wpdb->get_results( "SELECT status, COUNT(*) AS records FROM {$wpdb->prefix}edd_licenses GROUP BY status", ARRAY_A );
echo wp_json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ), PHP_EOL;
