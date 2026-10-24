<?php
/**
 * Read-only aggregate audit of historical EDD Wish Lists records.
 * Usage: php scripts/audit-edd-wishlists.php C:/laragon/www/creativehatti
 * Never prints names, emails, wishlist tokens, or raw metadata.
 */

if ( PHP_SAPI !== 'cli' || empty( $argv[1] ) ) {
	fwrite( STDERR, "Provide the WordPress installation directory.\n" );
	exit( 2 );
}

$wp_load = rtrim( $argv[1], "/\\" ) . DIRECTORY_SEPARATOR . 'wp-load.php';
if ( ! is_file( $wp_load ) ) {
	fwrite( STDERR, "WordPress bootstrap was not found.\n" );
	exit( 2 );
}

$_SERVER['REQUEST_SCHEME'] = $_SERVER['REQUEST_SCHEME'] ?? 'http';
$_SERVER['HTTP_HOST'] = $_SERVER['HTTP_HOST'] ?? 'creativehatti.test';

require $wp_load;
global $wpdb;

$rows = $wpdb->get_results(
	"SELECT ID, post_author, post_status FROM {$wpdb->posts} WHERE post_type = 'edd_wish_list' ORDER BY ID ASC",
	ARRAY_A
);
if ( ! is_array( $rows ) ) {
	fwrite( STDERR, "Could not read the historical wishlist records.\n" );
	exit( 1 );
}

$status_counts = array();
$authors = array();
$valid_authors = array();
$invalid_authors = array();
$authored_lists = 0;
$valid_author_lists = 0;
$invalid_author_lists = 0;
$guest_lists = 0;
$missing_item_meta = 0;
$empty_item_lists = 0;
$item_rows = 0;
$duplicate_products = 0;
$duplicate_product_price_pairs = 0;
$price_option_items = 0;
$lists_with_multiple_price_options_per_product = 0;
$missing_products = 0;
$non_download_products = 0;
$unpublished_downloads = 0;
$guest_tokens = array();
$author_ids = array();

foreach ( $rows as $row ) {
	$list_id = (int) $row['ID'];
	$author_id = (int) $row['post_author'];
	$status = (string) $row['post_status'];
	$status_counts[ $status ] = ( $status_counts[ $status ] ?? 0 ) + 1;
	$author_ids[ $author_id ] = true;

	if ( 0 === $author_id ) {
		$guest_lists++;
	} else {
		$authored_lists++;
		$authors[ $author_id ] = true;
		if ( get_user_by( 'id', $author_id ) ) {
			$valid_authors[ $author_id ] = true;
			$valid_author_lists++;
		} else {
			$invalid_authors[ $author_id ] = true;
			$invalid_author_lists++;
		}
	}

	$token = get_post_meta( $list_id, 'edd_wl_token', true );
	if ( is_string( $token ) && '' !== $token ) {
		// Keep token values in memory solely to count distinct/shared tokens.
		$token_hash = hash( 'sha256', $token );
		$guest_tokens[ $token_hash ] = ( $guest_tokens[ $token_hash ] ?? 0 ) + 1;
	}

	$items = get_post_meta( $list_id, 'edd_wish_list', true );
	if ( ! metadata_exists( 'post', $list_id, 'edd_wish_list' ) ) {
		$missing_item_meta++;
		continue;
	}
	if ( ! is_array( $items ) || empty( $items ) ) {
		$empty_item_lists++;
		continue;
	}

	$seen_products = array();
	$seen_pairs = array();
	$price_ids_by_product = array();
	foreach ( $items as $item ) {
		$item_rows++;
		$product_id = is_array( $item ) && isset( $item['id'] ) ? absint( $item['id'] ) : 0;
		if ( ! $product_id ) {
			$missing_products++;
			continue;
		}

		$product = get_post( $product_id );
		if ( ! $product ) {
			$missing_products++;
		} elseif ( 'download' !== $product->post_type ) {
			$non_download_products++;
		} elseif ( 'publish' !== $product->post_status ) {
			$unpublished_downloads++;
		}

		if ( isset( $seen_products[ $product_id ] ) ) {
			$duplicate_products++;
		}
		$seen_products[ $product_id ] = true;

		$options = is_array( $item['options'] ?? null ) ? $item['options'] : array();
		$price_id = array_key_exists( 'price_id', $options ) ? (string) $options['price_id'] : 'base';
		if ( 'base' !== $price_id ) {
			$price_option_items++;
		}
		$price_ids_by_product[ $product_id ][ $price_id ] = true;
		$pair = $product_id . ':' . $price_id;
		if ( isset( $seen_pairs[ $pair ] ) ) {
			$duplicate_product_price_pairs++;
		}
		$seen_pairs[ $pair ] = true;
	}
	foreach ( $price_ids_by_product as $price_ids ) {
		if ( count( $price_ids ) > 1 ) {
			$lists_with_multiple_price_options_per_product++;
		}
	}
}

$edd_customer_user_ids = array();
$customer_table = $wpdb->prefix . 'edd_customers';
$customer_table_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $customer_table ) ) === $customer_table;
if ( $customer_table_exists && $authors ) {
	$ids = array_map( 'intval', array_keys( $authors ) );
	$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
	$sql = $wpdb->prepare( "SELECT DISTINCT user_id FROM {$customer_table} WHERE user_id IN ({$placeholders}) AND user_id > 0", $ids );
	$edd_customer_user_ids = array_map( 'intval', (array) $wpdb->get_col( $sql ) );
}

$report = array(
	'read_only' => true,
	'wishlists_total' => count( $rows ),
	'wishlists_by_status' => $status_counts,
	'lists_with_zero_author_guest_shape' => $guest_lists,
		'lists_with_nonzero_author' => $authored_lists,
		'lists_with_existing_wordpress_authors' => $valid_author_lists,
		'lists_with_invalid_wordpress_author_references' => $invalid_author_lists,
		'distinct_nonzero_author_ids' => count( $authors ),
		'distinct_author_ids_existing_in_wordpress' => count( $valid_authors ),
		'distinct_author_ids_missing_from_wordpress' => count( $invalid_authors ),
	'distinct_author_ids_including_zero' => count( $author_ids ),
	'author_ids_also_linked_to_edd_customers' => count( $edd_customer_user_ids ),
	'edd_customer_table_available' => $customer_table_exists,
	'lists_with_guest_token_meta' => array_sum( $guest_tokens ),
	'distinct_guest_tokens' => count( $guest_tokens ),
	'guest_tokens_shared_by_multiple_lists' => count( array_filter( $guest_tokens, static function ( $count ) { return $count > 1; } ) ),
	'lists_missing_item_meta' => $missing_item_meta,
	'lists_with_empty_or_invalid_item_meta' => $empty_item_lists,
	'wishlist_item_rows' => $item_rows,
	'duplicate_product_occurrences_within_list' => $duplicate_products,
	'duplicate_product_and_price_option_occurrences_within_list' => $duplicate_product_price_pairs,
		'items_with_price_option' => $price_option_items,
		'lists_with_same_product_saved_at_multiple_price_options' => $lists_with_multiple_price_options_per_product,
	'items_missing_product_ids_or_deleted_products' => $missing_products,
	'items_referencing_non_download_posts' => $non_download_products,
	'items_referencing_unpublished_downloads' => $unpublished_downloads,
		'edd_wish_lists_extension_active' => in_array( 'edd-wish-lists/edd-wish-lists.php', (array) get_option( 'active_plugins', array() ), true ),
);

echo wp_json_encode( $report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL;
