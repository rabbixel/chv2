<?php
/**
 * Idempotent EDD Wish Lists importer. Defaults to dry-run; --apply writes only
 * new Creative Hatti wishlist rows and never changes legacy posts or metadata.
 * Usage: php scripts/migrate-edd-wishlists.php C:/laragon/www/creativehatti [--apply]
 */

if ( PHP_SAPI !== 'cli' || empty( $argv[1] ) ) {
	fwrite( STDERR, "Provide the WordPress installation directory.\n" );
	exit( 2 );
}

$wordpress_root = rtrim( $argv[1], "/\\" );
$wp_load = $wordpress_root . DIRECTORY_SEPARATOR . 'wp-load.php';
if ( ! is_file( $wp_load ) ) {
	fwrite( STDERR, "WordPress bootstrap was not found.\n" );
	exit( 2 );
}
$_SERVER['REQUEST_SCHEME'] = $_SERVER['REQUEST_SCHEME'] ?? 'http';
$_SERVER['HTTP_HOST'] = $_SERVER['HTTP_HOST'] ?? 'creativehatti.test';
require $wp_load;
global $wpdb;
$apply = in_array( '--apply', $argv, true );
if ( $apply ) {
	require_once $wordpress_root . '/wp-content/plugins/creative-hatti-api/includes/class-ch-wishlist-service.php';
}
$lists = $wpdb->get_results( "SELECT ID, post_author, post_date_gmt, post_date FROM {$wpdb->posts} WHERE post_type = 'edd_wish_list' ORDER BY post_date_gmt ASC, ID ASC", ARRAY_A );
if ( ! is_array( $lists ) ) {
	fwrite( STDERR, "Could not read historical wishlist records.\n" );
	exit( 1 );
}

$wishlist_table = $wpdb->prefix . 'ch_wishlist_items';
$wishlist_table_exists = $wishlist_table === $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wishlist_table ) );
$existing_pairs = array();
$existing_row_count = 0;
if ( $wishlist_table_exists ) {
	$existing_rows = $wpdb->get_results( "SELECT user_id, product_id FROM {$wishlist_table}", ARRAY_A );
	if ( ! is_array( $existing_rows ) ) {
		fwrite( STDERR, "Could not read the destination wishlist table.\n" );
		exit( 1 );
	}
	$existing_row_count = count( $existing_rows );
	foreach ( $existing_rows as $existing_row ) {
		$existing_pairs[ absint( $existing_row['user_id'] ) . ':' . absint( $existing_row['product_id'] ) ] = true;
	}
}

$service = $apply ? new CH_Wishlist_Service() : null;
$report = array(
	'mode' => $apply ? 'apply' : 'dry-run',
	'destination_table_exists' => $wishlist_table_exists,
	'destination_item_rows' => $existing_row_count,
	'legacy_lists_scanned' => count( $lists ),
	'items_seen' => 0,
	'items_eligible_for_import' => 0,
	'items_skipped_missing_or_invalid' => 0,
	'distinct_customer_product_pairs' => 0,
	'distinct_pairs_already_present_in_destination' => 0,
	'distinct_pairs_to_insert' => 0,
	'item_rows_deduplicated_by_customer_and_product' => 0,
	'lists_skipped_unmapped_customer' => 0,
	'items_newly_imported' => 0,
	'items_already_present_idempotent' => 0,
);
$customer_products = array();

foreach ( $lists as $list ) {
	$user_id = absint( $list['post_author'] );
	if ( ! $user_id || ! get_user_by( 'id', $user_id ) ) {
		$report['lists_skipped_unmapped_customer']++;
		continue;
	}
	$items = get_post_meta( (int) $list['ID'], 'edd_wish_list', true );
	if ( ! is_array( $items ) ) {
		continue;
	}
	$date = '' !== (string) $list['post_date_gmt'] && '0000-00-00 00:00:00' !== $list['post_date_gmt'] ? $list['post_date_gmt'] : $list['post_date'];
	foreach ( $items as $item ) {
		$report['items_seen']++;
		$product_id = is_array( $item ) && isset( $item['id'] ) ? absint( $item['id'] ) : 0;
		if ( ! $product_id ) {
			$report['items_skipped_missing_or_invalid']++;
			continue;
		}
		$report['items_eligible_for_import']++;
		$pair = $user_id . ':' . $product_id;
		if ( isset( $customer_products[ $pair ] ) ) {
			$report['item_rows_deduplicated_by_customer_and_product']++;
		} else {
			$customer_products[ $pair ] = true;
			$report['distinct_customer_product_pairs']++;
			$report[ isset( $existing_pairs[ $pair ] ) ? 'distinct_pairs_already_present_in_destination' : 'distinct_pairs_to_insert' ]++;
		}
		if ( ! $apply ) {
			continue;
		}
		$imported = $service->import_historical_item( $user_id, $product_id, $date );
		if ( is_wp_error( $imported ) ) {
			fwrite( STDERR, "Wishlist import stopped because storage returned an error.\n" );
			exit( 1 );
		}
		$report[ $imported ? 'items_newly_imported' : 'items_already_present_idempotent' ]++;
	}
}

echo wp_json_encode( $report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
