<?php
/** Pending-only EDD checkout preparation; no payment or completion hooks are run. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class CH_Checkout_Controller {
	private $auth;
	private $cart;
	private $limits;

	public function __construct( $auth, $cart ) { $this->auth = $auth; $this->cart = $cart; $this->limits = new CH_Purchase_Limit_Service(); }

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
		$rate_limit = $this->enforce_rate_limit( $request, 'quote' );
		if ( $rate_limit ) { return $rate_limit; }

		try {
			$calculation = $this->calculate( $request, false );
			return $this->private_response( CH_API::success( $this->quote_payload( $calculation ) ) );
		} catch ( Exception $error ) {
			return $this->private_response( CH_API::error( 'checkout_invalid', $error->getMessage(), 422 ) );
		}
	}

	public function prepare( $request ) {
		$key = (string) $request->get_header( 'idempotency-key' );
		if ( ! preg_match( '/^[a-f0-9-]{36}$/iD', $key ) ) {
			return $this->private_response( CH_API::error( 'invalid_idempotency_key', 'Refresh checkout and try again.', 400 ) );
		}

		global $wpdb;
		$user_id = get_current_user_id();
		$billing_input = $request->get_param( 'billing' );
		$billing_input = is_array( $billing_input ) ? $billing_input : array();
		$scope_email = strtolower( sanitize_email( (string) ( $billing_input['email'] ?? '' ) ) );
		$scope = $user_id ? 'user:' . $user_id : 'guest:' . hash( 'sha256', $scope_email );
		// The private free-session key stays bound to one payload even if the
		// visitor edits their email or signs in before retrying.
		if ( true === $request->get_param( 'independent_free' ) ) { $scope = 'independent_free'; }
		$digest = hash_hmac( 'sha256', $scope . '|' . strtolower( $key ), wp_salt( 'auth' ) );
		$transient = 'ch_checkout_' . substr( $digest, 0, 40 );
		$lock_name = 'ch_checkout_' . substr( $digest, 0, 48 );
		$locked = $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 5)', $lock_name ) );
		if ( '1' !== (string) $locked ) {
			return $this->private_response( CH_API::error( 'checkout_busy', 'Checkout is busy. Please retry shortly.', 503 ) );
		}

		try {
			$stored = get_transient( $transient );
			$existing_id = absint( is_array( $stored ) ? ( $stored['order_id'] ?? 0 ) : $stored );
			try {
				// A matching idempotency replay is allowed to read its own order even
				// after that order consumed the final available unit.
				$calculation = $this->calculate( $request, true, true, $existing_id, $existing_id > 0 );
			} catch ( Exception $error ) {
				return $this->private_response( CH_API::error( 'checkout_invalid', $error->getMessage(), 422 ) );
			}
			$payload_digest = $this->checkout_payload_digest( $calculation );
			if ( $existing_id ) {
				$existing = function_exists( 'edd_get_order' ) ? edd_get_order( $existing_id ) : false;
				if ( $existing ) {
					if ( true === $request->get_param( 'independent_free' ) && ! empty( $existing->user_id ) && (int) $existing->user_id !== $user_id ) {
						return $this->private_response( CH_API::error( 'checkout_owner_mismatch', 'This free checkout belongs to another signed-in customer.', 403 ) );
					}
					if ( ! is_array( $stored ) ) { return $this->private_response( CH_API::error( 'idempotency_payload_unverifiable', 'This checkout key predates payload verification. Refresh checkout and try again.', 409 ) ); }
					if ( is_array( $stored ) && ! hash_equals( (string) ( $stored['payload_digest'] ?? '' ), $payload_digest ) ) {
						return $this->private_response( CH_API::error( 'idempotency_payload_mismatch', 'This checkout key was already used with different checkout details.', 409 ) );
					}
					if ( 0.0 === (float) $calculation['total'] && 0.0 === (float) $existing->total && in_array( $existing->status, array( 'pending', 'complete' ), true ) ) {
						$order = 'pending' === $existing->status ? $this->complete_zero_total_order( $existing_id ) : $existing;
						if ( ! $order ) { return $this->private_response( CH_API::error( 'zero_total_completion_failed', 'The free order could not be completed. Retry checkout with the same key.', 503 ) ); }
						return $this->private_response( CH_API::success( $this->order_payload( $order, false ) ) );
					}
					if ( 'pending' !== $existing->status ) { return $this->private_response( CH_API::error( 'order_already_advanced', 'This order has already moved beyond pending.', 409 ) ); }
					return $this->private_response( CH_API::success( $this->order_payload( $existing, false ) ) );
				}
				delete_transient( $transient );
			}

			// Count only new orders. Idempotent replays returned above remain safe
			// even when the customer has reached the new-order limit.
			$rate_limit = $this->enforce_rate_limit( $request, 'prepare', strtolower( $key ) . '|' . $payload_digest );
			if ( $rate_limit ) { return $rate_limit; }

			$locked_products = $this->limits->acquire_for_products( array_column( $calculation['items'], 'id' ), 5 );
			if ( is_wp_error( $locked_products ) ) { return $this->private_response( CH_API::error( 'purchase_limit_busy', 'Product availability is being updated. Please retry shortly.', 503 ) ); }
			foreach ( $calculation['items'] as $item ) {
				$availability = $this->limits->availability( $item['id'], $item['quantity'] );
				if ( empty( $availability['available'] ) ) { return $this->private_response( CH_API::error( 'purchase_limit_exhausted', 'A product in your cart is no longer available.', 409 ) ); }
			}
			try {
				$locked_calculation = $this->calculate( $request, true, true );
			} catch ( Exception $error ) {
				return $this->private_response( CH_API::error( 'checkout_invalid', $error->getMessage(), 422 ) );
			}
			if ( ! hash_equals( $payload_digest, $this->checkout_payload_digest( $locked_calculation ) ) ) { return $this->private_response( CH_API::error( 'checkout_changed', 'Product availability or checkout details changed. Review your cart and try again.', 409 ) ); }
			$calculation = $locked_calculation;

			if ( '' !== $calculation['discount_code'] && ! $this->is_discount_valid_for_cart( $calculation['discount_code'], $calculation['discount_user'], $calculation['cart_items'] ) ) {
				return $this->private_response( CH_API::error( 'checkout_invalid', 'The discount code is unavailable or not eligible.', 422 ) );
			}

			if ( false === $wpdb->query( 'START TRANSACTION' ) ) { throw new RuntimeException( 'Could not start checkout transaction.' ); }
			$customer_id = $this->resolve_customer( $calculation['billing'], $user_id );
			if ( ! $customer_id ) { throw new RuntimeException( 'Could not prepare customer details.' ); }

			$order_id = edd_add_order( array(
				'type' => 'sale', 'status' => 'pending', 'user_id' => $user_id,
				'customer_id' => $customer_id, 'email' => $calculation['billing']['email'],
				'gateway' => 0.0 === (float) $calculation['total'] ? 'manual' : 'ch_razorpay', 'mode' => 0.0 !== (float) $calculation['total'] ? 'test' : ( function_exists( 'edd_is_test_mode' ) && edd_is_test_mode() ? 'test' : 'live' ),
				'currency' => edd_get_currency(), 'payment_key' => edd_generate_order_payment_key( $calculation['billing']['email'] ),
				'order_number' => function_exists( 'edd_set_order_number' ) ? edd_set_order_number() : '',
				'tax_rate_id' => $calculation['tax_rate_id'], 'subtotal' => $calculation['subtotal'],
				'discount' => $calculation['discount'], 'tax' => $calculation['tax'], 'total' => $calculation['total'],
			) );
			if ( ! $order_id ) { throw new RuntimeException( 'Could not prepare the pending order.' ); }
			if ( ! edd_update_order_meta( $order_id, 'ch_purchase_limit_reservation_state', 'reserved' ) || ! edd_update_order_meta( $order_id, 'ch_purchase_limit_reservation_expires_at', time() + ( 2 * DAY_IN_SECONDS ) ) ) { throw new RuntimeException( 'Could not persist product reservations.' ); }

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
			if ( ! function_exists( 'edd_update_order_meta' ) || ! edd_update_order_meta( $order_id, '_edd_phone', $calculation['billing']['phone'] ) ) {
				throw new RuntimeException( 'Could not save the validated phone number.' );
			}
			if ( function_exists( 'edd_update_customer_meta' ) ) {
				edd_update_customer_meta( $customer_id, 'phone', $calculation['billing']['phone'] );
			}
			if ( 0.0 === (float) $calculation['total'] ) {
				if ( ! function_exists( 'edd_update_order_meta' ) ) { throw new RuntimeException( 'EDD cannot record free-order metadata.' ); }
				edd_update_order_meta( $order_id, 'ch_checkout_type', 'zero_total' );
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
			$payment_token = bin2hex( random_bytes( 32 ) );
			if ( ! function_exists( 'edd_update_order_meta' ) || ! edd_update_order_meta( $order_id, 'ch_payment_authorization_hash', hash( 'sha256', $payment_token ) ) || ! set_transient( 'ch_pay_auth_' . (int) $order_id, $payment_token, 2 * DAY_IN_SECONDS ) ) {
				throw new RuntimeException( 'Could not authorize order status access.' );
			}
			if ( ! set_transient( $transient, array( 'order_id' => (int) $order_id, 'payload_digest' => $payload_digest ), 2 * DAY_IN_SECONDS ) ) { throw new RuntimeException( 'Could not save checkout idempotency state.' ); }
			if ( false === $wpdb->query( 'COMMIT' ) ) { throw new RuntimeException( 'Could not commit pending order.' ); }
			$order = edd_get_order( $order_id );
			if ( 0.0 === (float) $calculation['total'] ) {
				$order = $this->complete_zero_total_order( $order_id );
				if ( ! $order ) { return $this->private_response( CH_API::error( 'zero_total_completion_failed', 'The free order could not be completed. Retry checkout with the same key.', 503 ) ); }
			}
			return $this->private_response( CH_API::success( $this->order_payload( $order, true ), 201 ) );
		} catch ( Throwable $error ) {
			$wpdb->query( 'ROLLBACK' );
			return $this->private_response( CH_API::error( 'checkout_prepare_failed', 'Could not prepare the pending order. Please retry.', 500 ) );
		} finally {
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
			CH_Purchase_Limit_Service::release_all_locks();
		}
	}

	private function calculate( $request, $require_identity, $defer_discount_validation = false, $exclude_order_id = 0, $skip_purchase_limits = false ) {
		if ( ! function_exists( 'edd_add_order' ) || ! function_exists( 'edd_add_order_item' ) || ! function_exists( 'edd_add_order_address' ) ) {
			throw new RuntimeException( 'EDD checkout is unavailable.', 503 );
		}
		$cart_response = $this->cart->validate( $request, $exclude_order_id, $skip_purchase_limits );
		if ( $cart_response->get_status() >= 400 ) { throw new RuntimeException( 'The cart could not be validated.' ); }
		$cart_payload = $cart_response->get_data()['data'] ?? array();
		$validated = $cart_payload['items'] ?? array();
		if ( empty( $validated ) || count( $validated ) > 20 ) { throw new RuntimeException( 'Your cart is empty or too large.' ); }
		foreach ( $validated as $item ) {
			if ( empty( $item['available'] ) ) { throw new RuntimeException( ! empty( $item['message'] ) ? (string) $item['message'] : 'Your cart contains an unavailable product or price option.' ); }
		}
		$independent_free = true === $request->get_param( 'independent_free' );
		if ( $independent_free ) {
			$submitted = $request->get_param( 'items' );
			if ( ! is_array( $submitted ) || 1 !== count( $submitted ) || 1 !== count( $validated ) ||
				1 !== (int) $validated[0]['quantity'] || 0.0 !== (float) $validated[0]['unit_price'] ||
				'' !== trim( (string) $request->get_param( 'discount_code' ) ) ) {
				throw new RuntimeException( 'Independent free checkout requires one free item without a discount.' );
			}
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
			'full_name' => '', 'email' => '', 'phone' => '', 'country' => $country, 'region' => $region,
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
			$billing['phone'] = $this->validated_phone( $billing_input['phone'] ?? '', true );
			foreach ( array( 'address' => 'address', 'city' => 'city', 'postal_code' => 'postal_code' ) as $key => $source ) {
				$value = sanitize_text_field( (string) ( $billing_input[ $source ] ?? '' ) );
				if ( strlen( $value ) > 190 ) { throw new RuntimeException( 'Billing details are too long.' ); }
				$billing[ $key ] = $value;
			}
		} elseif ( '' !== trim( (string) ( $billing_input['phone'] ?? '' ) ) ) {
			$billing['phone'] = $this->validated_phone( $billing_input['phone'], false );
		}

		$discount_code = strtoupper( sanitize_text_field( (string) $request->get_param( 'discount_code' ) ) );
		if ( strlen( $discount_code ) > 64 ) { throw new RuntimeException( 'The discount code is invalid.' ); }
		$cart_items = array();
		foreach ( $validated as $item ) {
			$options = null === $item['price_id'] ? array() : array( 'price_id' => (int) $item['price_id'] );
			$cart_items[] = array( 'id' => (int) $item['product_id'], 'options' => $options, 'quantity' => (int) $item['quantity'] );
		}
		$discount = false;
		if ( '' !== $discount_code ) {
			$discount = function_exists( 'edd_get_discount_by_code' ) ? edd_get_discount_by_code( $discount_code ) : false;
			$discount_user = get_current_user_id() ? get_current_user_id() : ( $billing['email'] ?: '' );
			if ( ! $discount || ! function_exists( 'edd_is_discount_valid' ) || ( ! $defer_discount_validation && ! $this->is_discount_valid_for_cart( $discount_code, $discount_user, $cart_items ) ) ) { throw new RuntimeException( 'The discount code is unavailable or not eligible.' ); }
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
		if ( $independent_free && ( 0.0 !== $total || 0.0 !== $subtotal || 0.0 !== $tax_total ) ) {
			throw new RuntimeException( 'This product is no longer free.' );
		}
		return array(
			'items' => $items, 'subtotal' => $subtotal, 'discount' => $discount_total,
			'tax' => $tax_total, 'total' => $total, 'tax_rate_id' => $tax_rate_id,
			'taxes_enabled' => (bool) $taxes_enabled, 'discount_code' => $discount_total > 0 ? $discount_code : '',
			'discount_object' => $discount_total > 0 ? $discount : false, 'billing' => $billing,
			'cart_items' => $cart_items, 'discount_user' => $discount_user ?? '',
		);
	}

	/** Return a validated E.164 phone number, applying national rules for common regions. */
	private function validated_phone( $value, $required ) {
		$raw = sanitize_text_field( (string) $value );
		$phone = preg_replace( '/[\s().-]/', '', $raw );
		if ( '' === $phone && ! $required ) { return ''; }
		if ( ! preg_match( '/^\+[1-9][0-9]{7,14}$/', $phone ) ) {
			throw new RuntimeException( 'Enter a valid phone number with country code, such as +91 98765 43210.' );
		}
		$digits = substr( $phone, 1 );
		$national = static function ( $calling_code ) use ( $digits ) { return substr( $digits, strlen( $calling_code ) ); };
		$valid = true;
		if ( 0 === strpos( $digits, '91' ) ) { $valid = (bool) preg_match( '/^[6-9][0-9]{9}$/', $national( '91' ) ); }
		elseif ( 0 === strpos( $digits, '1' ) ) { $valid = (bool) preg_match( '/^[2-9][0-9]{2}[2-9][0-9]{6}$/', $national( '1' ) ); }
		elseif ( 0 === strpos( $digits, '44' ) ) { $valid = (bool) preg_match( '/^[0-9]{9,10}$/', $national( '44' ) ); }
		elseif ( 0 === strpos( $digits, '61' ) ) { $valid = (bool) preg_match( '/^[0-9]{9}$/', $national( '61' ) ); }
		elseif ( 0 === strpos( $digits, '65' ) ) { $valid = (bool) preg_match( '/^[6-9][0-9]{7}$/', $national( '65' ) ); }
		elseif ( 0 === strpos( $digits, '971' ) ) { $valid = (bool) preg_match( '/^[0-9]{9}$/', $national( '971' ) ); }
		elseif ( 0 === strpos( $digits, '64' ) ) { $valid = (bool) preg_match( '/^[0-9]{8,10}$/', $national( '64' ) ); }
		elseif ( 0 === strpos( $digits, '33' ) ) { $valid = (bool) preg_match( '/^[0-9]{9}$/', $national( '33' ) ); }
		elseif ( 0 === strpos( $digits, '49' ) ) { $valid = (bool) preg_match( '/^[0-9]{7,13}$/', $national( '49' ) ); }
		elseif ( 0 === strpos( $digits, '81' ) ) { $valid = (bool) preg_match( '/^[0-9]{9,10}$/', $national( '81' ) ); }
		elseif ( 0 === strpos( $digits, '55' ) ) { $valid = (bool) preg_match( '/^[0-9]{10,11}$/', $national( '55' ) ); }
		else { $valid = strlen( $digits ) >= 8 && strlen( $digits ) <= 15; }
		if ( ! $valid ) { throw new RuntimeException( 'Enter a valid phone number for its country code.' ); }
		return $phone;
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

	private function checkout_payload_digest( $calculation ) {
		$payload = array(
			'items' => $calculation['items'],
			'discount_code' => $calculation['discount_code'],
			'billing' => $calculation['billing'],
			'currency' => edd_get_currency(),
		);
		return hash( 'sha256', wp_json_encode( $payload ) );
	}

	private function is_discount_valid_for_cart( $code, $user, $items ) {
		if ( ! function_exists( 'EDD' ) || ! is_object( EDD()->cart ) || ! isset( EDD()->cart->contents ) ) {
			return edd_is_discount_valid( $code, $user, false );
		}

		$cart = EDD()->cart;
		$original_contents = $cart->contents;
		$original_details = $cart->details;
		$cart->contents = $items;
		$cart->details = array();
		if ( method_exists( $cart, 'invalidate_cache' ) ) { $cart->invalidate_cache(); }
		try {
			return edd_is_discount_valid( $code, $user, false );
		} finally {
			$cart->contents = $original_contents;
			$cart->details = $original_details;
			if ( method_exists( $cart, 'invalidate_cache' ) ) { $cart->invalidate_cache(); }
		}
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
		$payment_allowed = 'pending' === $order->status && (float) $order->total > 0;
		$status_allowed = $payment_allowed || ( 'complete' === $order->status && 0.0 === (float) $order->total && 'zero_total' === edd_get_order_meta( $order->id, 'ch_checkout_type', true ) );
		$payment_token_hash = $status_allowed && function_exists( 'edd_get_order_meta' ) ? edd_get_order_meta( $order->id, 'ch_payment_authorization_hash', true ) : '';
		$payment_token = $status_allowed && function_exists( 'get_transient' ) ? get_transient( 'ch_pay_auth_' . (int) $order->id ) : '';
		if ( ! $payment_token_hash ) { $payment_token = ''; }
		return array(
			'id' => (int) $order->id,
			'number' => (string) $order->get_number(),
			'status' => (string) $order->status,
			'total' => $this->money( $order->total, $order->currency ),
			'created' => (bool) $created,
			// This response is consumed only by the Next.js server BFF, never by UI.
			'payment_authorization_token' => $payment_token,
		);
	}

	/** Complete a zero-value order through EDD's native free-purchase status flow. */
	private function complete_zero_total_order( $order_id ) {
		if ( ! function_exists( 'edd_get_order' ) || ! function_exists( 'edd_update_payment_status' ) ) { return false; }
		$order = edd_get_order( $order_id );
		if ( ! $order || 'sale' !== $order->type || 0.0 !== (float) $order->total ) { return false; }
		if ( 'complete' === $order->status ) { return $order; }
		if ( 'pending' !== $order->status || 'manual' !== $order->gateway ) { return false; }
		if ( ! edd_update_payment_status( $order_id, 'complete' ) ) { return false; }
		$order = edd_get_order( $order_id );
		return $order && 'complete' === $order->status && 0.0 === (float) $order->total ? $order : false;
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

	/**
	 * Enforce a per-account or signed guest-browser fixed-window limit.
	 * The bridge keeps the identity server-to-server; REMOTE_ADDR belongs to the
	 * Next.js host here and must not be treated as the visitor address.
	 */
	private function enforce_rate_limit( $request, $type, $idempotency_key = '' ) {
		$identity = $this->rate_limit_identity( $request );
		if ( false === $identity ) {
			return $this->private_response( CH_API::error( 'checkout_session_invalid', 'Your checkout session is invalid. Refresh the page and try again.', 400 ) );
		}

		$policy = $this->rate_limit_policy( $type );
		$identity_hash = hash_hmac( 'sha256', $identity, wp_salt( 'auth' ) );
		$rate_key = 'ch_rate_checkout_' . $type . '_' . $identity_hash;
		$attempt_hash = '' !== $idempotency_key ? hash_hmac( 'sha256', strtolower( $idempotency_key ), wp_salt( 'auth' ) ) : '';
		$lock_name = 'ch_rate_checkout_' . substr( hash( 'sha256', $type . '|' . $identity_hash ), 0, 40 );
		global $wpdb;
		$locked = $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 3)', $lock_name ) );
		if ( '1' !== (string) $locked ) {
			return $this->private_response( CH_API::error( 'checkout_busy', 'Checkout is busy. Please retry shortly.', 503 ) );
		}

		try {
			$now = time();
			$record = get_transient( $rate_key );
			if ( ! is_array( $record ) || ! isset( $record['count'], $record['reset_at'] ) || (int) $record['reset_at'] <= $now ) {
				$record = array( 'count' => 0, 'reset_at' => $now + $policy['window'] );
			}
			$record['count'] = max( 0, (int) $record['count'] );
			$record['reset_at'] = (int) $record['reset_at'];
			$attempts = isset( $record['attempts'] ) && is_array( $record['attempts'] ) ? $record['attempts'] : array();
			if ( '' !== $attempt_hash && in_array( $attempt_hash, $attempts, true ) ) { return null; }
			if ( $record['count'] >= $policy['limit'] ) {
				$response = CH_API::error( 'checkout_rate_limited', 'You have tried checkout too many times. Please wait a little and try again.', 429 );
				$response->header( 'Retry-After', (string) max( 1, $record['reset_at'] - $now ) );
				return $this->private_response( $response );
			}

			++$record['count'];
			if ( '' !== $attempt_hash ) {
				$attempts[] = $attempt_hash;
				$record['attempts'] = $attempts;
			}
			if ( ! set_transient( $rate_key, $record, max( 1, $record['reset_at'] - $now ) ) ) {
				return $this->private_response( CH_API::error( 'checkout_rate_limit_unavailable', 'Checkout is temporarily unavailable. Please retry shortly.', 503 ) );
			}
			return null;
		} finally {
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
		}
	}

	private function rate_limit_identity( $request ) {
		$user_id = function_exists( 'get_current_user_id' ) ? absint( get_current_user_id() ) : 0;
		if ( $user_id > 0 ) { return 'user:' . $user_id; }

		$token = (string) $request->get_header( 'x-ch-checkout-rate-token' );
		if ( ! preg_match( '/^([a-f0-9]{64})\.([a-f0-9]{64})$/D', $token, $match ) ) { return false; }
		$secret = defined( 'CH_LOCAL_AUTH_BRIDGE_SECRET' ) ? (string) constant( 'CH_LOCAL_AUTH_BRIDGE_SECRET' ) : (string) getenv( 'CH_AUTH_BRIDGE_SECRET' );
		if ( strlen( $secret ) < 32 ) { return false; }
		$expected = hash_hmac( 'sha256', 'ch-checkout-rate-v1:' . $match[1], $secret );
		return hash_equals( $expected, $match[2] ) ? 'guest:' . $match[1] : false;
	}

	private function rate_limit_policy( $type ) {
		// Site-specific tuning is supported with ch_checkout_{quote|prepare}_rate_limit
		// and ch_checkout_{quote|prepare}_rate_window filters.
		$defaults = 'quote' === $type
			? array( 'limit' => 60, 'window' => defined( 'MINUTE_IN_SECONDS' ) ? MINUTE_IN_SECONDS : 60 )
			: array( 'limit' => 10, 'window' => defined( 'HOUR_IN_SECONDS' ) ? HOUR_IN_SECONDS : 3600 );
		$limit = function_exists( 'apply_filters' ) ? apply_filters( 'ch_checkout_' . $type . '_rate_limit', $defaults['limit'] ) : $defaults['limit'];
		$window = function_exists( 'apply_filters' ) ? apply_filters( 'ch_checkout_' . $type . '_rate_window', $defaults['window'] ) : $defaults['window'];
		return array( 'limit' => max( 1, min( 10000, (int) $limit ) ), 'window' => max( 1, min( DAY_IN_SECONDS, (int) $window ) ) );
	}
}
