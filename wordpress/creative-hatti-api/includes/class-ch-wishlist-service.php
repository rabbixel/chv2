<?php
/** Persistent, customer-owned wishlist storage. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class CH_Wishlist_Service {
	private const SCHEMA_VERSION = '1';
	private static $installed = false;
	private $wpdb;

	public function __construct() {
		global $wpdb;
		$this->wpdb = $wpdb;
	}

	/** Create the small table lazily so an already-active plugin upgrades safely. */
	private function ensure_table() {
		if ( self::$installed ) { return true; }
		$table = $this->table_name();
		$exists = $this->wpdb->get_var( $this->wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
		if ( self::SCHEMA_VERSION === (string) get_option( 'ch_api_wishlist_schema_version', '' ) && $table === $exists ) {
			self::$installed = true;
			return true;
		}

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset = $this->wpdb->get_charset_collate();
		$sql = "CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL,
			product_id bigint(20) unsigned NOT NULL,
			added_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY user_product (user_id,product_id),
			KEY user_id (user_id)
		) {$charset};";
		dbDelta( $sql );
		$exists = $this->wpdb->get_var( $this->wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
		if ( $table !== $exists ) {
			return new WP_Error( 'wishlist_storage_unavailable', 'Wishlist storage is unavailable.', array( 'status' => 503 ) );
		}
		update_option( 'ch_api_wishlist_schema_version', self::SCHEMA_VERSION, false );
		self::$installed = true;
		return true;
	}

	/** Read only the authenticated user's list. */
	public function get_wishlist( $user_id ) {
		$user_id = absint( $user_id );
		if ( ! $user_id ) { return new WP_Error( 'wishlist_auth_required', 'Authentication required.', array( 'status' => 401 ) ); }
		$ready = $this->ensure_table();
		if ( is_wp_error( $ready ) ) { return $ready; }
		$table = $this->table_name();
		$rows = $this->wpdb->get_results( $this->wpdb->prepare( "SELECT product_id, added_at FROM {$table} WHERE user_id = %d ORDER BY added_at ASC, id ASC", $user_id ), ARRAY_A );
		if ( ! is_array( $rows ) ) { return $this->storage_error(); }

		$items = array();
		$updated = 0;
		foreach ( $rows as $row ) {
			$timestamp = strtotime( (string) $row['added_at'] . ' UTC' );
			$timestamp = false === $timestamp ? time() : $timestamp;
			$updated = max( $updated, $timestamp );
			$items[] = array(
				'productId' => (string) absint( $row['product_id'] ),
				'addedAt' => gmdate( DATE_ATOM, $timestamp ),
			);
		}

		return array(
			'id' => 'wp-user-' . $user_id,
			'customerId' => (string) $user_id,
			'items' => $items,
			'updatedAt' => gmdate( DATE_ATOM, $updated ?: time() ),
		);
	}

	/** Add is idempotent under duplicate and concurrent requests. */
	public function add_item( $user_id, $product_id ) {
		$user_id = absint( $user_id );
		$product_id = absint( $product_id );
		if ( ! $user_id || ! $product_id ) { return new WP_Error( 'invalid_wishlist_item', 'The saved product is invalid.', array( 'status' => 400 ) ); }
		$ready = $this->ensure_table();
		if ( is_wp_error( $ready ) ) { return $ready; }
		$table = $this->table_name();
		$inserted = $this->wpdb->query( $this->wpdb->prepare( "INSERT IGNORE INTO {$table} (user_id, product_id, added_at) VALUES (%d, %d, %s)", $user_id, $product_id, gmdate( 'Y-m-d H:i:s' ) ) );
		if ( false === $inserted ) { return $this->storage_error(); }
		return $this->get_wishlist( $user_id );
	}

	/** Removing a missing item succeeds and leaves other customer records untouched. */
	public function remove_item( $user_id, $product_id ) {
		$user_id = absint( $user_id );
		$product_id = absint( $product_id );
		if ( ! $user_id || ! $product_id ) { return new WP_Error( 'invalid_wishlist_item', 'The saved product is invalid.', array( 'status' => 400 ) ); }
		$ready = $this->ensure_table();
		if ( is_wp_error( $ready ) ) { return $ready; }
		$table = $this->table_name();
		$deleted = $this->wpdb->query( $this->wpdb->prepare( "DELETE FROM {$table} WHERE user_id = %d AND product_id = %d", $user_id, $product_id ) );
		if ( false === $deleted ) { return $this->storage_error(); }
		return $this->get_wishlist( $user_id );
	}

	/** CLI migration helper; unique storage makes repeat imports idempotent. */
	public function import_historical_item( $user_id, $product_id, $added_at ) {
		$user_id = absint( $user_id );
		$product_id = absint( $product_id );
		if ( ! $user_id || ! $product_id ) { return new WP_Error( 'invalid_wishlist_item', 'The historical wishlist item is invalid.', array( 'status' => 400 ) ); }
		$timestamp = strtotime( (string) $added_at . ' UTC' );
		$timestamp = false === $timestamp ? time() : $timestamp;
		$ready = $this->ensure_table();
		if ( is_wp_error( $ready ) ) { return $ready; }
		$table = $this->table_name();
		$inserted = $this->wpdb->query( $this->wpdb->prepare( "INSERT IGNORE INTO {$table} (user_id, product_id, added_at) VALUES (%d, %d, %s)", $user_id, $product_id, gmdate( 'Y-m-d H:i:s', $timestamp ) ) );
		if ( false === $inserted ) { return $this->storage_error(); }
		return 1 === (int) $inserted;
	}

	private function table_name() {
		return $this->wpdb->prefix . 'ch_wishlist_items';
	}

	private function storage_error() {
		return new WP_Error( 'wishlist_storage_unavailable', 'Wishlist storage is unavailable.', array( 'status' => 503 ) );
	}
}
