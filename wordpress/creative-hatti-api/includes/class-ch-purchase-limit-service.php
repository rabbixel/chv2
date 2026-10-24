<?php
/**
 * Site-wide EDD purchase limits with durable order-item reservations.
 *
 * @package CreativeHattiAPI
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class CH_Purchase_Limit_Service {
	private static $held_locks = array();
	private static $shutdown_registered = false;
	private $wpdb;

	public function __construct() {
		global $wpdb;
		$this->wpdb = $wpdb;
	}

	public function register_hooks() {
		add_action( 'edd_checkout_error_checks', array( $this, 'validate_native_cart' ), 1, 2 );
		add_filter( 'edd_should_update_order_status', array( $this, 'guard_status_transition' ), 1, 4 );
		add_filter( 'edd_should_update_payment_status', array( $this, 'guard_status_transition' ), 1, 4 );
	}

	/** Return the historical site-wide limit. Zero means unlimited; -1 is a permanent sold-out sentinel. */
	public function get_limit( $product_id ) {
		$raw = get_post_meta( (int) $product_id, '_edd_purchase_limit', true );
		if ( null === $raw ) { return 0; }
		if ( ! is_scalar( $raw ) ) { return -2; }
		$raw = trim( (string) $raw );
		if ( '' === $raw ) { return 0; }
		if ( ! preg_match( '/^-?[0-9]+$/D', $raw ) ) { return -2; }
		$value = (int) $raw;
		return $value >= 0 || -1 === $value ? $value : -2;
	}

	/** Availability is informational unless called again under the product locks before persistence. */
	public function availability( $product_id, $quantity = 1, $exclude_order_id = 0 ) {
		$product_id = (int) $product_id;
		$quantity = max( 1, (int) $quantity );
		$limit = $this->get_limit( $product_id );
		if ( 0 === $limit ) { return array( 'available' => true, 'sold_out' => false, 'limit' => null, 'remaining' => null ); }
		if ( -1 === $limit ) { return array( 'available' => false, 'sold_out' => true, 'limit' => -1, 'remaining' => 0 ); }
		if ( $limit < 0 || ! function_exists( 'get_post_meta' ) ) { return array( 'available' => false, 'sold_out' => false, 'limit' => max( 0, $limit ), 'remaining' => 0 ); }
		$sales = $this->gross_sales_quantity( $product_id );
		if ( false === $sales ) { return array( 'available' => false, 'sold_out' => false, 'limit' => $limit, 'remaining' => 0 ); }
		$reserved = $this->reserved_quantity( $product_id, (int) $exclude_order_id );
		if ( false === $reserved ) { return array( 'available' => false, 'sold_out' => false, 'limit' => $limit, 'remaining' => 0 ); }
		$remaining = max( 0, $limit - (int) $sales - $reserved );
		return array( 'available' => $remaining >= $quantity, 'sold_out' => (int) $sales >= $limit, 'limit' => $limit, 'remaining' => $remaining );
	}

	/** Acquire all limited-product mutexes in numeric order to avoid deadlocks. */
	public function acquire_for_products( $product_ids, $timeout = 5 ) {
		$ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $product_ids ) ) ) );
		sort( $ids, SORT_NUMERIC );
		$limited = array();
		foreach ( $ids as $id ) { if ( 0 !== $this->get_limit( $id ) ) { $limited[] = $id; } }
		$new_locks = array();
		foreach ( $limited as $id ) {
			$name = $this->lock_name( $id );
			if ( isset( self::$held_locks[ $name ] ) ) { continue; }
			$locked = $this->wpdb->get_var( $this->wpdb->prepare( 'SELECT GET_LOCK(%s, %d)', $name, max( 0, (int) $timeout ) ) );
			if ( '1' !== (string) $locked ) {
				foreach ( $new_locks as $new_name ) { $this->release_one( $new_name ); }
				return new WP_Error( 'purchase_limit_busy', 'Product availability is being updated. Please retry shortly.' );
			}
			self::$held_locks[ $name ] = true;
			$new_locks[] = $name;
		}
		if ( $limited && ! self::$shutdown_registered ) {
			self::$shutdown_registered = true;
			register_shutdown_function( array( __CLASS__, 'release_all_locks' ) );
		}
		return true;
	}

	/** Release locks acquired by this request. */
	public static function release_all_locks() {
		global $wpdb;
		foreach ( array_keys( self::$held_locks ) as $name ) {
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $name ) );
			unset( self::$held_locks[ $name ] );
		}
		self::$shutdown_registered = false;
	}

	/** Product IDs in an EDD order. */
	public function order_product_quantities( $order_id ) {
		if ( function_exists( 'edd_get_order_items' ) ) {
			$items = edd_get_order_items( array( 'order_id' => (int) $order_id, 'number' => 0, 'no_found_rows' => true ) );
			if ( ! is_array( $items ) ) { return false; }
			$result = array();
			foreach ( $items as $item ) {
				$id = absint( is_object( $item ) ? ( $item->product_id ?? 0 ) : ( $item['product_id'] ?? 0 ) );
				$quantity = max( 0, (int) ( is_object( $item ) ? ( $item->quantity ?? 0 ) : ( $item['quantity'] ?? 0 ) ) );
				if ( $id && $quantity ) { $result[ $id ] = ( $result[ $id ] ?? 0 ) + $quantity; }
			}
			return $result;
		}
		$table = $this->wpdb->prefix . 'edd_order_items';
		$rows = $this->wpdb->get_results( $this->wpdb->prepare( "SELECT product_id, SUM(quantity) AS quantity FROM {$table} WHERE order_id = %d AND product_id > 0 GROUP BY product_id", (int) $order_id ), ARRAY_A );
		if ( ! is_array( $rows ) ) { return false; }
		$result = array();
		foreach ( $rows as $row ) { $result[ (int) $row['product_id'] ] = (int) $row['quantity']; }
		return $result;
	}

	/** Native EDD classic checkout hook; unpaid order rows become durable reservations. */
	public function validate_native_cart( $valid_data = array(), $post_data = array() ) {
		if ( ! function_exists( 'edd_get_cart_contents' ) || ! function_exists( 'edd_set_error' ) ) { return; }
		$cart = (array) edd_get_cart_contents();
		$quantities = array();
		foreach ( $cart as $item ) {
			$id = absint( $item['id'] ?? $item['product_id'] ?? 0 );
			if ( ! $id || 0 === $this->get_limit( $id ) ) { continue; }
			$qty = function_exists( 'edd_item_quantities_enabled' ) && edd_item_quantities_enabled() ? max( 1, (int) ( $item['quantity'] ?? 1 ) ) : 1;
			$quantities[ $id ] = ( $quantities[ $id ] ?? 0 ) + $qty;
		}
		if ( ! $quantities ) { return; }
		$locked = $this->acquire_for_products( array_keys( $quantities ), 5 );
		if ( is_wp_error( $locked ) ) { edd_set_error( 'ch_purchase_limit_busy', 'Product availability is being updated. Please retry shortly.' ); return; }
		foreach ( $quantities as $id => $quantity ) {
			$availability = $this->availability( $id, $quantity );
			if ( empty( $availability['available'] ) ) {
				edd_set_error( 'ch_purchase_limit', -1 === $this->get_limit( $id ) ? 'This product is sold out.' : 'The requested quantity is no longer available.' );
			}
		}
	}

	/** All EDD-supported completion paths share this capacity check and lock. */
	public function guard_status_transition( $allow, $order_id, $new_status, $old_status ) {
		if ( ! $allow || 'complete' !== (string) $new_status || 'complete' === (string) $old_status ) { return $allow; }
		$order = function_exists( 'edd_get_order' ) ? edd_get_order( (int) $order_id ) : false;
		if ( ! $order || 'sale' !== (string) $order->type ) { return $allow; }
		$quantities = $this->order_product_quantities( $order_id );
		if ( false === $quantities ) { return false; }
		if ( ! $quantities ) { return $allow; }
		$limited_ids = array();
		foreach ( $quantities as $id => $quantity ) { if ( 0 !== $this->get_limit( $id ) ) { $limited_ids[] = $id; } }
		if ( ! $limited_ids ) { return $allow; }
		$locked = $this->acquire_for_products( $limited_ids, 5 );
		if ( is_wp_error( $locked ) ) { return false; }
		foreach ( $quantities as $id => $quantity ) {
			if ( 0 === $this->get_limit( $id ) ) { continue; }
			$availability = $this->availability( $id, $quantity, (int) $order_id );
			if ( empty( $availability['available'] ) ) {
				if ( function_exists( 'edd_set_error' ) ) { edd_set_error( 'ch_purchase_limit', 'This order cannot be completed because a product purchase limit has been reached.' ); }
				return false;
			}
		}
		return $allow;
	}

	private function reserved_quantity( $product_id, $exclude_order_id ) {
		$items = $this->wpdb->prefix . 'edd_order_items';
		$orders = $this->wpdb->prefix . 'edd_orders';
		$meta = $this->wpdb->prefix . 'edd_ordermeta';
		// EDD 3.7 stores the order-meta foreign key as edd_order_id (the
		// order-items table uses order_id). Keep this query aligned with EDD's
		// native schema so availability checks don't fail closed for every
		// limited product.
		$sql = "SELECT COALESCE(SUM(i.quantity), 0) FROM {$items} i INNER JOIN {$orders} o ON o.id = i.order_id WHERE i.product_id = %d AND o.type = 'sale' AND o.id <> %d AND o.status NOT IN ('complete','completed','publish','partially_refunded','refunded') AND NOT (EXISTS (SELECT 1 FROM {$meta} expiry WHERE expiry.edd_order_id = o.id AND expiry.meta_key = 'ch_purchase_limit_reservation_expires_at' AND CAST(expiry.meta_value AS UNSIGNED) <= UNIX_TIMESTAMP()) AND NOT EXISTS (SELECT 1 FROM {$meta} rp_order WHERE rp_order.edd_order_id = o.id AND rp_order.meta_key = 'ch_razorpay_order_id' AND rp_order.meta_value <> '') AND NOT EXISTS (SELECT 1 FROM {$meta} rp_state WHERE rp_state.edd_order_id = o.id AND rp_state.meta_key = 'ch_razorpay_creation_state' AND rp_state.meta_value IN ('creating','uncertain','created')))";
		$value = $this->wpdb->get_var( $this->wpdb->prepare( $sql, (int) $product_id, (int) $exclude_order_id ) );
		return is_numeric( $value ) && (int) $value >= 0 ? (int) $value : false;
	}

	/**
	 * Count site-wide sales using the same gross order-item statuses as the
	 * historical EDD Purchase Limit add-on. Gross statuses deliberately retain
	 * refunded items in the cap so a refund cannot reopen a previously sold
	 * limited design.
	 *
	 * @return int|false Quantity, or false when EDD cannot provide reliable data.
	 */
	private function gross_sales_quantity( $product_id ) {
		if ( ! function_exists( 'edd_get_gross_order_statuses' ) ) { return false; }
		$statuses = array_values( array_unique( (array) edd_get_gross_order_statuses() ) );
		if ( ! $statuses ) { return false; }
		foreach ( $statuses as $status ) {
			if ( ! is_string( $status ) || ! preg_match( '/^[a-z_]+$/D', $status ) ) { return false; }
		}
		$items = $this->wpdb->prefix . 'edd_order_items';
		$orders = $this->wpdb->prefix . 'edd_orders';
		$placeholders = implode( ',', array_fill( 0, count( $statuses ), '%s' ) );
		$sql = "SELECT COALESCE(SUM(oi.quantity), 0) FROM {$items} oi INNER JOIN {$orders} o ON o.id = oi.order_id WHERE o.type = %s AND oi.product_id = %d AND oi.status IN ({$placeholders})";
		$args = array_merge( array( 'sale', (int) $product_id ), $statuses );
		$value = $this->wpdb->get_var( $this->wpdb->prepare( $sql, $args ) );
		return is_numeric( $value ) && (int) $value >= 0 ? (int) $value : false;
	}

	private function lock_name( $product_id ) {
		$blog_id = function_exists( 'get_current_blog_id' ) ? get_current_blog_id() : 1;
		return 'chpl_' . substr( hash( 'sha256', (int) $blog_id . ':' . (int) $product_id ), 0, 56 );
	}

	private function release_one( $name ) {
		$this->wpdb->get_var( $this->wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $name ) );
		unset( self::$held_locks[ $name ] );
	}
}
