<?php
/** Pending-only EDD checkout preparation; no payment or completion hooks are run. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class CH_Checkout_Controller {
	private $auth;
	private $cart;

	public function __construct( $auth, $cart ) { $this->auth = $auth; $this->cart = $cart; }

	public function register_routes() {
		foreach ( array( 'quote' => 'quote', 'prepare' => 'prepare' ) as $route => $callback ) {
			register_rest_route( CH_API::NAMESPACE, '/checkout/' . $route, array(
				'methods' => WP_REST_Server::CREATABLE,
				'callback' => array( $this, $callback ),
				'permission_callback' => array( $this, 'bridge_permission' ),
			) );
		}
	}

	public function bridge_permission( $request ) {
		$bridge = $this->auth->bridge_permission( $request );
		if ( true !== $bridge ) { return $bridge; }
		return '' !== (string) $request->get_header( 'authorization' )
			? $this->auth->session_permission( $request )
			: true;
	}

	public function quote( $request ) {
		try {
			$calculation = $this->calculate( $request, false );
			return $this->private_response( CH_API::success( $this->quote_payload( $calculation ) ) );
		} catch ( Exception $error ) {
			return $this->private_response( CH_API::error( 'checkout_invalid', $error->getMessage(), 422 ) );
		}
	}

	public function prepare( $request ) {
		try {
			$calculation = $this->calculate( $request, true );
		} catch ( Exception $error ) {
			return $this->private_response( CH_API::error( 'checkout_invalid', $error->getMessage(), 422 ) );
		}

		if ( $calculation['total'] <= 0 ) {
			return $this->private_response( CH_API::error( 'zero_total_requires_review', 'Zero-total orders require a separate verified completion flow.', 422 ) );
		}

		$key = (string) $request->get_header( 'idempotency-key' );
		if ( ! preg_match( '/^[a-f0-9-]{36}$/iD', $key ) ) {
			return $this->private_response( CH_API::error( 'invalid_idempotency_key', 'Refresh checkout and try again.', 400 ) );
		}

		global $wpdb;
		$user_id = get_current_user_id();
		$scope = $user_id ? 'user:' . $user_id : 'guest:' . hash( 'sha256', strtolower( $calculation['billing']['email'] ) );
		$digest = hash_hmac( 'sha256', $scope . '|' . strtolower( $key ), wp_salt( 'auth' ) );
		$transient = 'ch_checkout_' . substr( $digest, 0, 40 );
		$lock_name = 'ch_checkout_' . substr( $digest, 0, 48 );
		$locked = $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 5)', $lock_name ) );
		if ( '1' !== (string) $locked ) {
			return $this->private_response( CH_API::error( 'checkout_busy', 'Checkout is busy. Please retry shortly.', 503 ) );
		}

		try {
			$existing_id = absint( get_transient( $transient ) );
			if ( $existing_id ) {
				$existing = function_exists( 'edd_get_order' ) ? edd_get_order( $existing_id ) : false;
				if ( $existing ) {
					if ( 'pending' !== $existing->status ) { return $this->private_response( CH_API::error( 'order_already_advanced', 'This order has already moved beyond pending.', 409 ) ); }
					return $this->private_response( CH_API::success( $this->order_payload( $existing, false ) ) );
				}
				delete_transient( $transient );
			}

			if ( false === $wpdb->query( 'START TRANSACTION' ) ) { throw new RuntimeException( 'Could not start checkout transaction.' ); }
			$customer_id = $this->resolve_customer( $calculation['billing'], $user_id );
			if ( ! $customer_id ) { throw new RuntimeException( 'Could not prepare customer details.' ); }

			$order_id = edd_add_order( array(
				'type' => 'sale', 'status' => 'pending', 'user_id' => $user_id,
				'customer_id' => $customer_id, 'email' => $calculation['billing']['email'],
				'gateway' => '', 'mode' => function_exists( 'edd_is_test_mode' ) && edd_is_test_mode() ? 'test' : 'live',
				'currency' => edd_get_currency(), 'payment_key' => edd_generate_order_payment_key( $calculation['billing']['email'] ),
				'order_number' => function_exists( 'edd_set_order_number' ) ? edd_set_order_number() : '',
				'tax_rate_id' => $calculation['tax_rate_id'], 'subtotal' => $calculation['subtotal'],
				'discount' => $calculation['discount'], 'tax' => $calculation['tax'], 'total' => $calculation['total'],
			) );
			if ( ! $order_id ) { throw new RuntimeException( 'Could not prepare the pending order.' ); }

			foreach ( $calculation['items'] as $index => $item ) {
				$item_id = edd_add_order_item( array(
					'order_id' => $order_id, 'product_id' => $item['id'],
					'product_name' => edd_get_download_name( $item['id'], $item['price_id'] ),
					'price_id' => $item['price_id'], 'cart_index' => $index,
					'type' => 'download', 'status' => 'pending', 'quantity' => $item['quantity'],
					'amount' => $item['amount'], 'subtotal' => $item['subtotal'],
					'discount' => $item['discount'], 'tax' => $item['tax'], 'total' => $item['total'],
				) );
				if ( ! $item_id ) { throw new RuntimeException( 'Could not prepare an order item.' ); }
			}
			if ( $calculation['discount'] > 0 ) {
				if ( ! function_exists( 'edd_add_order_adjustment' ) || ! $calculation['discount_object'] ) { throw new RuntimeException( 'Could not record the checkout discount.' ); }
				$adjustment_id = edd_add_order_adjustment( array(
					'object_id' => $order_id, 'object_type' => 'order',
					'type_id' => (int) $calculation['discount_object']->id, 'type' => 'discount',
					'description' => $calculation['discount_code'],
					'subtotal' => $calculation['discount'], 'total' => $calculation['discount'],
				) );
				if ( ! $adjustment_id ) { throw new RuntimeException( 'Could not record the checkout discount.' ); }
			}

			$billing = $calculation['billing'];
			$address_id = edd_add_order_address( array(
				'order_id' => $order_id, 'name' => $billing['full_name'],
				'address' => $billing['address'], 'city' => $billing['city'],
				'region' => $billing['region'], 'postal_code' => $billing['postal_code'],
				'country' => $billing['country'],
			) );
			if ( false === $address_id ) { throw new RuntimeException( 'Could not save billing details.' ); }

			$customer = edd_get_customer( $customer_id );
			if ( ! $customer || ! $customer->attach_payment( $order_id, false ) ) { throw new RuntimeException( 'Could not link the pending order.' ); }
			if ( ! set_transient( $transient, (int) $order_id, 2 * DAY_IN_SECONDS ) ) { throw new RuntimeException( 'Could not save checkout idempotency state.' ); }
			if ( false === $wpdb->query( 'COMMIT' ) ) { throw new RuntimeException( 'Could not commit pending order.' ); }
			$order = edd_get_order( $order_id );
			return $this->private_response( CH_API::success( $this->order_payload( $order, true ), 201 ) );
		} catch ( Throwable $error ) {
			$wpdb->query( 'ROLLBACK' );
			return $this->private_response( CH_API::error( 'checkout_prepare_failed', 'Could not prepare the pending order. Please retry.', 500 ) );
		} finally {
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
		}
	}

	private function calculate( $request, $require_identity ) {
		if ( ! function_exists( 'edd_add_order' ) || ! function_exists( 'edd_add_order_item' ) || ! function_exists( 'edd_add_order_address' ) ) {
			throw new RuntimeException( 'EDD checkout is unavailable.', 503 );
		}
		$cart_response = $this->cart->validate( $request );
		if ( $cart_response->get_status() >= 400 ) { throw new RuntimeException( 'The cart could not be validated.' ); }
		$cart_payload = $cart_response->get_data()['data'] ?? array();
		$validated = $cart_payload['items'] ?? array();
		if ( empty( $validated ) || count( $validated ) > 20 ) { throw new RuntimeException( 'Your cart is empty or too large.' ); }
		foreach ( $validated as $item ) {
			if ( empty( $item['available'] ) ) { throw new RuntimeException( 'Your cart contains an unavailable product or price option.' ); }
		}

		$billing_input = $request->get_param( 'billing' );
		$billing_input = is_array( $billing_input ) ? $billing_input : array();
		$taxes_enabled = function_exists( 'edd_use_taxes' ) && edd_use_taxes();
		$country = strtoupper( sanitize_text_field( (string) ( $billing_input['country'] ?? '' ) ) );
		$region = sanitize_text_field( (string) ( $billing_input['region'] ?? '' ) );
		if ( $taxes_enabled ) {
			$countries = function_exists( 'edd_get_country_list' ) ? edd_get_country_list() : array();
			if ( ! preg_match( '/^[A-Z]{2}$/', $country ) || ! isset( $countries[ $country ] ) ) { throw new RuntimeException( 'Select a valid billing country to calculate tax.' ); }
			if ( strlen( $region ) > 100 ) { throw new RuntimeException( 'Check your billing region.' ); }
		} else {
			$country = preg_match( '/^[A-Z]{2}$/', $country ) ? $country : '';
		}

		$billing = array(
			'full_name' => '', 'email' => '', 'country' => $country, 'region' => $region,
			'address' => '', 'city' => '', 'postal_code' => '',
		);
		if ( $require_identity ) {
			$name = sanitize_text_field( (string) ( $billing_input['full_name'] ?? '' ) );
			$email = strtolower( sanitize_email( (string) ( $billing_input['email'] ?? '' ) ) );
			$user_id = get_current_user_id();
			if ( $user_id ) {
				$user = get_userdata( $user_id );
				if ( ! $user || ! is_email( $user->user_email ) ) { throw new RuntimeException( 'Sign in again to continue checkout.', 401 ); }
				$email = strtolower( $user->user_email );
				if ( '' === $name ) { $name = trim( get_user_meta( $user_id, 'first_name', true ) . ' ' . get_user_meta( $user_id, 'last_name', true ) ); }
			}
			if ( strlen( $name ) < 2 || strlen( $name ) > 120 || ! is_email( $email ) || strlen( $email ) > 254 ) { throw new RuntimeException( 'Enter a valid billing name and email.' ); }
			$billing['full_name'] = $name;
			$billing['email'] = $email;
			foreach ( array( 'address' => 'address', 'city' => 'city', 'postal_code' => 'postal_code' ) as $key => $source ) {
				$value = sanitize_text_field( (string) ( $billing_input[ $source ] ?? '' ) );
				if ( strlen( $value ) > 190 ) { throw new RuntimeException( 'Billing details are too long.' ); }
				$billing[ $key ] = $value;
			}
		}

		$discount_code = strtoupper( sanitize_text_field( (string) $request->get_param( 'discount_code' ) ) );
		if ( strlen( $discount_code ) > 64 ) { throw new RuntimeException( 'The discount code is invalid.' ); }
		$discount = false;
		if ( '' !== $discount_code ) {
			$discount = function_exists( 'edd_get_discount_by_code' ) ? edd_get_discount_by_code( $discount_code ) : false;
			$discount_user = get_current_user_id() ? get_current_user_id() : ( $billing['email'] ?: '' );
			if ( ! $discount || ! function_exists( 'edd_is_discount_valid' ) || ! edd_is_discount_valid( $discount_code, $discount_user, false ) ) { throw new RuntimeException( 'The discount code is unavailable or not eligible.' ); }
		}

		$cart_items = array();
		foreach ( $validated as $item ) {
			$options = null === $item['price_id'] ? array() : array( 'price_id' => (int) $item['price_id'] );
			$cart_items[] = array( 'id' => (int) $item['product_id'], 'options' => $options, 'quantity' => (int) $item['quantity'] );
		}

		$rate = $taxes_enabled && function_exists( 'edd_get_tax_rate' ) ? (float) edd_get_tax_rate( $country, $region, true ) : 0.0;
		$tax_rate_row = $taxes_enabled && function_exists( 'edd_get_tax_rate_by_location' )
			? edd_get_tax_rate_by_location( array( 'country' => $country, 'region' => $region ) ) : false;
		$tax_rate_id = ! empty( $tax_rate_row->id ) ? (int) $tax_rate_row->id : null;
		$includes_tax = $taxes_enabled && function_exists( 'edd_prices_include_tax' ) && edd_prices_include_tax();
		$items = array(); $subtotal = 0.0; $discount_total = 0.0; $tax_total = 0.0; $total = 0.0;
		foreach ( $validated as $index => $item ) {
			$unit_amount = (float) $item['unit_price'] / 100;
			$quantity = (int) $item['quantity'];
			$line_subtotal = $unit_amount * $quantity;
			$item_discount = $discount ? (float) edd_get_item_discount_amount( $cart_items[ $index ], $cart_items, array( $discount ), $unit_amount ) : 0.0;
			$item_discount = min( max( 0.0, $item_discount ), $line_subtotal );
			$taxable = max( 0.0, $line_subtotal - $item_discount );
			$item_tax = $taxes_enabled && function_exists( 'edd_download_is_tax_exclusive' ) && ! edd_download_is_tax_exclusive( (int) $item['product_id'] )
				? (float) edd_calculate_tax( $taxable, $country, $region, true, $rate ) : 0.0;
			$stored_subtotal = $includes_tax ? max( 0.0, $line_subtotal - $item_tax ) : $line_subtotal;
			$item_total = max( 0.0, $stored_subtotal - $item_discount + $item_tax );
			$subtotal += $stored_subtotal; $discount_total += $item_discount; $tax_total += $item_tax; $total += $item_total;
			$items[] = array(
				'id' => (int) $item['product_id'], 'price_id' => $item['price_id'] === null ? null : (int) $item['price_id'],
				'quantity' => $quantity, 'amount' => $unit_amount, 'subtotal' => $stored_subtotal,
				'discount' => $item_discount, 'tax' => $item_tax, 'total' => $item_total,
			);
		}
		if ( '' !== $discount_code && $discount_total <= 0 ) { throw new RuntimeException( 'The discount code does not apply to these products.' ); }
		return array(
			'items' => $items, 'subtotal' => $subtotal, 'discount' => $discount_total,
			'tax' => $tax_total, 'total' => $total, 'tax_rate_id' => $tax_rate_id,
			'taxes_enabled' => (bool) $taxes_enabled, 'discount_code' => $discount_total > 0 ? $discount_code : '',
			'discount_object' => $discount_total > 0 ? $discount : false, 'billing' => $billing,
		);
	}

	private function quote_payload( $calculation ) {
		$currency = edd_get_currency();
		return array(
			'currency' => $currency,
			'subtotal' => $this->money( $calculation['subtotal'], $currency ),
			'discount' => $this->money( $calculation['discount'], $currency ),
			'tax' => $this->money( $calculation['tax'], $currency ),
			'total' => $this->money( $calculation['total'], $currency ),
			'discount_code' => $calculation['discount_code'],
			'taxes_enabled' => $calculation['taxes_enabled'],
		);
	}

	private function resolve_customer( $billing, $user_id ) {
		if ( $user_id ) {
			$customer = edd_get_customer_by( 'user_id', $user_id );
			if ( $customer && (int) $customer->user_id === (int) $user_id ) { return (int) $customer->id; }
		}
		$customer_id = edd_add_customer( array(
			'user_id' => $user_id ? (int) $user_id : 0,
			'email' => $user_id ? strtolower( get_userdata( $user_id )->user_email ) : $billing['email'],
			'name' => $billing['full_name'],
		) );
		return $customer_id ? (int) $customer_id : 0;
	}

	private function order_payload( $order, $created ) {
		return array(
			'id' => (int) $order->id,
			'number' => (string) $order->get_number(),
			'status' => 'pending',
			'total' => $this->money( $order->total, $order->currency ),
			'created' => (bool) $created,
		);
	}

	private function money( $amount, $currency ) {
		return array( 'amount' => (int) round( (float) $amount * 100 ), 'currency' => strtoupper( (string) $currency ) );
	}

	private function private_response( $response ) {
		$response = rest_ensure_response( $response );
		$response->header( 'Cache-Control', 'private, no-store, no-cache, max-age=0, must-revalidate' );
		$response->header( 'Pragma', 'no-cache' );
		return $response;
	}
}
