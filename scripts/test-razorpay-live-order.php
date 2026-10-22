<?php
/** Live Razorpay test-mode order creation check; uses and removes only its synthetic EDD order. */
$_SERVER['REQUEST_SCHEME'] = 'http';
$_SERVER['HTTP_HOST'] = 'creativehatti.test';
require 'C:/laragon/www/creativehatti/wp-load.php';

$bridge_secret = defined( 'CH_LOCAL_AUTH_BRIDGE_SECRET' ) ? (string) CH_LOCAL_AUTH_BRIDGE_SECRET : (string) getenv( 'CH_AUTH_BRIDGE_SECRET' );
if ( '' === $bridge_secret ) {
	$frontend_env = 'C:/Users/rajes/Documents/Playground/creative-hatti/.env.local';
	if ( is_readable( $frontend_env ) ) {
		foreach ( file( $frontend_env, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES ) as $line ) {
			if ( 0 === strpos( trim( $line ), 'CH_AUTH_BRIDGE_SECRET=' ) ) {
				$bridge_secret = trim( substr( trim( $line ), strlen( 'CH_AUTH_BRIDGE_SECRET=' ) ), " \t\n\r\0\x0B\"'" );
				break;
			}
		}
	}
}
if ( strlen( $bridge_secret ) < 32 ) {
	fwrite( STDERR, "The trusted WordPress bridge is not configured for the local endpoint check.\n" );
	exit( 1 );
}

$product_id = 11152;
$price_id = 2;
$prices = function_exists( 'edd_get_variable_prices' ) ? (array) edd_get_variable_prices( $product_id ) : array();
$expected_rupees = isset( $prices[ $price_id ]['amount'] ) ? (float) $prices[ $price_id ]['amount'] : 0.0;
if ( 49.0 !== $expected_rupees || 'INR' !== strtoupper( (string) edd_get_currency() ) ) {
	fwrite( STDERR, "Synthetic fixture price or store currency changed; no order was created.\n" );
	exit( 1 );
}

$prior_order = false;
if ( function_exists( 'edd_get_orders' ) ) {
	foreach ( (array) edd_get_orders( array( 'type' => 'sale', 'number' => 50, 'orderby' => 'id', 'order' => 'DESC' ) ) as $candidate ) {
		if ( preg_match( '/^rzptest-[a-f0-9]{16}@example\.test$/D', strtolower( (string) $candidate->email ) ) ) { $prior_order = $candidate; break; }
	}
}
$email = $prior_order ? strtolower( (string) $prior_order->email ) : 'rzptest-' . substr( str_replace( '-', '', wp_generate_uuid4() ), 0, 16 ) . '@example.test';
$idempotency_key = wp_generate_uuid4();
if ( ! $prior_order && edd_get_customer_by( 'email', $email ) ) {
	fwrite( STDERR, "Synthetic customer collision; no order was created.\n" );
	exit( 1 );
}
$orders_before = edd_count_orders( array( 'type' => 'sale' ) ) - ( $prior_order ? 1 : 0 );
$order_id = $prior_order ? (int) $prior_order->id : 0;
$customer_id = $prior_order ? (int) $prior_order->customer_id : 0;
$razorpay_id = '';
$checks_passed = false;
$safe_no_provider_call = false;
$payment_token = $prior_order ? (string) get_transient( 'ch_pay_auth_' . $order_id ) : '';
$billing = array( 'full_name' => 'Synthetic Razorpay Test', 'email' => $email, 'phone' => '+919876543210', 'country' => 'IN', 'region' => '' );
$items = array( array( 'product_id' => $product_id, 'price_id' => $price_id, 'quantity' => 1 ) );

$checkout = new CH_Checkout_Controller( new CH_Auth_Controller(), new CH_Cart_Controller( new CH_Auth_Controller() ) );
$payment_request = static function ( $params, $bridge_secret ) {
	$response = wp_remote_post( 'http://creativehatti.test/wp-json/ch/v1/payment/razorpay/order', array(
		'timeout' => 30,
		'redirection' => 0,
		'headers' => array( 'X-CH-Auth-Bridge' => $bridge_secret, 'Content-Type' => 'application/json' ),
		'body' => wp_json_encode( $params ),
	) );
	if ( is_wp_error( $response ) ) { throw new RuntimeException( 'Local secure payment endpoint could not be reached.' ); }
	$body = wp_remote_retrieve_body( $response );
	$clean_body = preg_replace( '/^\xEF\xBB\xBF/', '', $body );
	$data = json_decode( $clean_body, true );
	return array( 'status' => (int) wp_remote_retrieve_response_code( $response ), 'content_type' => (string) wp_remote_retrieve_header( $response, 'content-type' ), 'body_length' => strlen( $body ), 'json_error' => json_last_error_msg(), 'data' => $data );
};

try {
	if ( $prior_order ) {
		$state = (string) edd_get_order_meta( $order_id, 'ch_razorpay_creation_state', true );
		if ( in_array( $state, array( 'creating', 'uncertain' ), true ) ) { throw new RuntimeException( 'Prior synthetic provider attempt is uncertain; retained for reconciliation.' ); }
		if ( '' === $payment_token ) { throw new RuntimeException( 'Prior synthetic order capability expired; retained rather than replacing its authorization.' ); }
	} else {
		$prepare_request = new WP_REST_Request( 'POST', '/ch/v1/checkout/prepare' );
		$prepare_request->set_param( 'items', $items );
		$prepare_request->set_param( 'billing', $billing );
		$prepare_request->set_param( 'discount_code', '' );
		$prepare_request->set_header( 'Idempotency-Key', $idempotency_key );
		$prepared = $checkout->prepare( $prepare_request );
		$prepared_data = $prepared instanceof WP_REST_Response ? $prepared->get_data() : array();
		$order_id = (int) ( $prepared_data['data']['id'] ?? 0 );
		if ( 201 !== $prepared->get_status() || 'pending' !== ( $prepared_data['data']['status'] ?? '' ) || 4900 !== ( $prepared_data['data']['total']['amount'] ?? -1 ) || ! $order_id ) {
			throw new RuntimeException( 'Could not create the expected synthetic pending INR 49 EDD order.' );
		}
		$payment_token = (string) ( $prepared_data['data']['payment_authorization_token'] ?? '' );
		if ( ! preg_match( '/^[a-f0-9]{64}$/D', $payment_token ) ) { throw new RuntimeException( 'Checkout did not issue a server-side order capability.' ); }
		$prepared_order = edd_get_order( $order_id );
		$customer_id = $prepared_order ? (int) $prepared_order->customer_id : 0;
	}

	$payment_params = array( 'order_id' => $order_id, 'authorization_token' => $payment_token );
	$created = $payment_request( $payment_params, $bridge_secret );
	$payment = $created['data']['data'] ?? array();
	$razorpay_id = (string) ( $payment['razorpay_order_id'] ?? '' );
	if ( 200 !== $created['status'] || ! preg_match( '/^order_[A-Za-z0-9]+$/D', $razorpay_id ) || 4900 !== (int) ( $payment['amount'] ?? 0 ) || 'INR' !== ( $payment['currency'] ?? '' ) || ! preg_match( '/^rzp_test_[A-Za-z0-9]+$/D', (string) ( $payment['key_id'] ?? '' ) ) ) {
		$error_code = sanitize_key( (string) ( $created['data']['error']['code'] ?? $created['data']['code'] ?? 'response_mismatch' ) );
		$safe_no_provider_call = 'payment_unavailable' === $error_code;
		$shape = is_array( $created['data'] ) ? implode( ',', array_keys( $created['data'] ) ) : 'non-json';
		$local_order = $order_id ? edd_get_order( $order_id ) : false;
		$edd_state = $local_order ? sanitize_key( $local_order->status . '_' . $local_order->type . '_' . $local_order->currency ) : 'missing';
		$edd_total = $local_order ? (string) $local_order->total : 'na';
		throw new RuntimeException( 'Razorpay endpoint response failed validation (HTTP ' . (int) $created['status'] . ', ' . $error_code . ', ' . sanitize_key( $created['content_type'] ) . ', ' . sanitize_key( $shape ) . ', body-' . (int) $created['body_length'] . ', ' . sanitize_key( $created['json_error'] ) . ', ' . $edd_state . ', INR-total-' . sanitize_key( $edd_total ) . ').' );
	}
	if ( $razorpay_id !== (string) edd_get_order_meta( $order_id, 'ch_razorpay_order_id', true ) ) { throw new RuntimeException( 'Razorpay order ID was not persisted against the EDD order.' ); }

	$retried = $payment_request( $payment_params, $bridge_secret );
	if ( 200 !== $retried['status'] || $razorpay_id !== (string) ( $retried['data']['data']['razorpay_order_id'] ?? '' ) ) { throw new RuntimeException( 'Payment-order retry did not reuse the same Razorpay order.' ); }

	$order = edd_get_order( $order_id );
	$order_items = $order ? $order->get_items() : array();
	$deliverable = false;
	foreach ( (array) $order_items as $order_item ) {
		if ( ! method_exists( $order_item, 'is_deliverable' ) || $order_item->is_deliverable() ) { $deliverable = true; }
	}
	if ( ! $order || 'pending' !== $order->status || count( $order_items ) !== 1 || $deliverable ) { throw new RuntimeException( 'The EDD order is not pending or an item became deliverable.' ); }
	if ( function_exists( 'edd_software_licensing' ) && edd_software_licensing() && ! empty( edd_software_licensing()->licenses_db ) ) {
		$license_count = (int) edd_software_licensing()->licenses_db->count( array( 'payment_id' => $order_id ) );
		if ( $license_count > 0 ) { throw new RuntimeException( 'A license entitlement was created before payment.' ); }
	}
	$checks_passed = true;
	printf( "PASS: test credentials loaded; EDD order %s remains pending; Razorpay order %s is INR 4900 paise, persisted and reused; no deliverable item or license entitlement.\n", (string) $order->get_number(), $razorpay_id );
} catch ( Throwable $error ) {
	fwrite( STDERR, 'FAIL: ' . $error->getMessage() . PHP_EOL );
} finally {
	// Keep the EDD record if the provider outcome is uncertain or any invariant failed.
	$creation_state = $order_id ? (string) edd_get_order_meta( $order_id, 'ch_razorpay_creation_state', true ) : '';
	$stored_razorpay_id = $order_id ? (string) edd_get_order_meta( $order_id, 'ch_razorpay_order_id', true ) : '';
	$can_cleanup = $checks_passed || ( $safe_no_provider_call && '' === $stored_razorpay_id && ! in_array( $creation_state, array( 'creating', 'uncertain' ), true ) );
	if ( $can_cleanup && $order_id && edd_get_order( $order_id ) ) {
		edd_delete_purchase( $order_id, true, false );
		delete_transient( 'ch_pay_auth_' . $order_id );
		delete_transient( 'ch_rzp_attempts_' . $order_id );
		$scope = 'guest:' . hash( 'sha256', strtolower( $email ) );
		$digest = hash_hmac( 'sha256', $scope . '|' . strtolower( $idempotency_key ), wp_salt( 'auth' ) );
		delete_transient( 'ch_checkout_' . substr( $digest, 0, 40 ) );
		if ( $customer_id ) {
			$customer = edd_get_customer( $customer_id );
			if ( $customer && empty( $customer->payment_ids ) ) { edd_destroy_customer( $customer_id ); }
		}
		if ( edd_get_order( $order_id ) || edd_get_customer_by( 'email', $email ) || edd_count_orders( array( 'type' => 'sale' ) ) !== $orders_before ) {
			fwrite( STDERR, "FAIL: synthetic local order/customer cleanup could not be verified.\n" );
			exit( 1 );
		}
		echo $checks_passed ? "PASS: synthetic EDD order and unused customer removed; remote Razorpay test order remains unpaid.\n" : "PASS: synthetic EDD order removed safely; credentials were unavailable, so no Razorpay API order was attempted.\n";
	} elseif ( $order_id ) {
		fwrite( STDERR, "Synthetic EDD order retained for safe reconciliation; no cleanup was attempted.\n" );
	}
}
if ( ! $checks_passed ) { exit( 1 ); }
