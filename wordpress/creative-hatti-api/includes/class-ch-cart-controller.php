<?php
/** Server-authoritative cart validation. This endpoint never creates an order. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class CH_Cart_Controller {
	private $auth;
	private $limits;
	public function __construct( $auth, $limits = null ) { $this->auth = $auth; $this->limits = $limits instanceof CH_Purchase_Limit_Service ? $limits : new CH_Purchase_Limit_Service(); }

	public function register_routes() {
		register_rest_route( CH_API::NAMESPACE, '/cart/validate', array(
			'methods' => WP_REST_Server::CREATABLE,
			'callback' => array( $this, 'validate' ),
			'permission_callback' => array( $this, 'bridge_permission' ),
			'args' => array( 'items' => array( 'type' => 'array', 'required' => true ) ),
		) );
	}

	public function bridge_permission( $request ) {
		$bridge = $this->auth->bridge_permission( $request );
		if ( true !== $bridge ) { return $bridge; }
		return '' !== (string) $request->get_header( 'authorization' )
			? $this->auth->session_permission( $request )
			: true;
	}

	public function validate( $request, $exclude_order_id = 0, $skip_purchase_limits = false ) {
		$input = $request->get_param( 'items' );
		if ( ! is_array( $input ) || count( $input ) > 20 ) {
			return CH_API::error( 'invalid_cart', 'Cart is invalid or too large.', 400 );
		}
		$quantities_enabled = function_exists( 'edd_item_quantities_enabled' ) && edd_item_quantities_enabled();
		$normalized = array();
		foreach ( $input as $row ) {
			if ( ! is_array( $row ) ) { return CH_API::error( 'invalid_cart_item', 'A cart item is invalid.', 400 ); }
			$product_raw = isset( $row['product_id'] ) && is_scalar( $row['product_id'] ) ? (string) $row['product_id'] : '';
			$product_id = preg_match( '/^[1-9][0-9]*$/', $product_raw ) ? (int) $product_raw : 0;
			$price_id = array_key_exists( 'price_id', $row ) && null !== $row['price_id'] ? ( is_scalar( $row['price_id'] ) && preg_match( '/^(0|[1-9][0-9]*)$/', (string) $row['price_id'] ) ? (int) $row['price_id'] : -1 ) : null;
			$quantity = isset( $row['quantity'] ) && is_scalar( $row['quantity'] ) && preg_match( '/^[1-9][0-9]*$/', (string) $row['quantity'] ) ? (int) $row['quantity'] : 0;
			if ( ! $product_id || -1 === $price_id || $quantity < 1 || $quantity > 10 ) { return CH_API::error( 'invalid_cart_item', 'A cart item is invalid.', 400 ); }
			$key = $product_id . ':' . ( null === $price_id ? 'base' : $price_id );
			if ( isset( $normalized[ $key ] ) ) { $normalized[ $key ]['quantity'] = $quantities_enabled ? min( 10, $normalized[ $key ]['quantity'] + $quantity ) : 1; }
			else { $normalized[ $key ] = array( 'product_id' => $product_id, 'price_id' => $price_id, 'quantity' => $quantities_enabled ? $quantity : 1 ); }
		}

		$currency = function_exists( 'edd_get_currency' ) ? edd_get_currency() : 'USD';
		$items = array(); $subtotal = 0; $item_count = 0;
		foreach ( $normalized as $row ) {
			$id = $row['product_id']; $price_id = $row['price_id']; $quantity = $row['quantity'];
			$product = function_exists( 'edd_get_download' ) ? edd_get_download( $id ) : false;
			$base = array( 'product_id' => $id, 'price_id' => $price_id, 'quantity' => $quantity, 'title' => 'Product unavailable', 'slug' => '', 'thumbnail' => null, 'option_name' => '', 'price_options' => array(), 'unit_price' => 0, 'line_total' => 0, 'available' => false, 'message' => 'This product is no longer available.' );
			if ( ! $product || 'publish' !== get_post_status( $id ) || ! method_exists( $product, 'can_purchase' ) || ! $product->can_purchase() ) { $items[] = $base; continue; }

			$variable = function_exists( 'edd_has_variable_prices' ) && edd_has_variable_prices( $id );
			$prices = $variable && function_exists( 'edd_get_variable_prices' ) ? (array) edd_get_variable_prices( $id ) : array();
			if ( $variable && ( null === $price_id || ! array_key_exists( $price_id, $prices ) ) || ! $variable && null !== $price_id ) { $base['message'] = 'The selected price option is unavailable.'; $items[] = $base; continue; }
			$raw_amount = $variable ? ( $prices[ $price_id ]['amount'] ?? null ) : get_post_meta( $id, 'edd_price', true );
			if ( ! is_numeric( $raw_amount ) || ! is_finite( (float) $raw_amount ) || (float) $raw_amount < 0 ) { $items[] = $base; continue; }
			$resolved_amount = $variable ? edd_get_price_option_amount( $id, $price_id ) : edd_get_download_price( $id );
			if ( ! is_numeric( $resolved_amount ) ) { $items[] = $base; continue; }
			$amount = (float) $resolved_amount;
			if ( ! is_finite( $amount ) || $amount < 0 ) { $items[] = $base; continue; }
			if ( ! $quantities_enabled || ( method_exists( $product, 'quantities_disabled' ) && $product->quantities_disabled() ) ) { $quantity = 1; }
			if ( ! $skip_purchase_limits ) {
				$limit_state = $this->limits->availability( $id, $quantity, $exclude_order_id );
				if ( empty( $limit_state['available'] ) ) { $base['message'] = ! empty( $limit_state['sold_out'] ) ? 'This product is sold out.' : 'The requested quantity exceeds the remaining purchase limit.'; $items[] = $base; continue; }
			}
			$title = get_the_title( $id );
			$options = array();
			foreach ( $prices as $option_id => $option ) {
				if ( ! is_numeric( $option['amount'] ?? null ) || ! is_finite( (float) $option['amount'] ) || (float) $option['amount'] < 0 ) { continue; }
				$options[] = array( 'id' => (int) $option_id, 'name' => sanitize_text_field( $option['name'] ?? '' ), 'amount' => (int) round( (float) $option['amount'] * 100 ) );
			}
			$option_name = $variable ? sanitize_text_field( $prices[ $price_id ]['name'] ?? '' ) : '';
			$unit = (int) round( $amount * 100 ); $line = $unit * $quantity;
			$items[] = array( 'product_id' => $id, 'price_id' => $price_id, 'quantity' => $quantity, 'title' => wp_strip_all_tags( $title ), 'slug' => (string) get_post_field( 'post_name', $id ), 'thumbnail' => get_the_post_thumbnail_url( $id, 'medium' ) ?: null, 'option_name' => $option_name, 'price_options' => $options, 'unit_price' => $unit, 'line_total' => $line, 'available' => true, 'message' => '' );
			$subtotal += $line; $item_count += $quantity;
		}
		$response = CH_API::success( array( 'currency' => $currency, 'items' => $items, 'item_count' => $item_count, 'subtotal' => $subtotal ) );
		$response->header( 'Cache-Control', 'private, no-store, no-cache, max-age=0, must-revalidate' );
		$response->header( 'Pragma', 'no-cache' );
		return $response;
	}
}
