<?php
/**
 * One isolated guest free-order integration check against local EDD.
 * The synthetic order, its unique customer, and its idempotency transient are
 * removed through EDD/WordPress APIs in finally; no coupon is used.
 */
$_SERVER['REQUEST_SCHEME'] = 'http';
$_SERVER['HTTP_HOST'] = 'creativehatti.test';
require 'C:/laragon/www/creativehatti/wp-load.php';

$email = 'ca-' . substr( str_replace( '-', '', wp_generate_uuid4() ), 0, 12 ) . '@example.test';
$key = wp_generate_uuid4();
$email_valid = is_email( $email );
$prior_customer = edd_get_customer_by( 'email', $email );
if ( $prior_customer ) {
	fwrite( STDERR, "Synthetic email unexpectedly exists; refusing to proceed.\n" );
	exit( 1 );
}
if ( ! $email_valid ) {
	fwrite( STDERR, "WordPress rejected the synthetic email.\n" );
	exit( 1 );
}

$cart = new CH_Cart_Controller( new CH_Auth_Controller() );
$checkout = new CH_Checkout_Controller( new CH_Auth_Controller(), $cart );
$orders_before = edd_count_orders( array( 'type' => 'sale' ) );
$order_id = 0;
$customer_id = 0;
$receipt_priority = has_action( 'edd_complete_purchase', 'edd_trigger_purchase_receipt' );
if ( false !== $receipt_priority ) {
	remove_action( 'edd_complete_purchase', 'edd_trigger_purchase_receipt', $receipt_priority );
}

try {
	$request = new WP_REST_Request( 'POST', '/ch/v1/checkout/prepare' );
	$request->set_param( 'items', array( array( 'product_id' => 2858, 'price_id' => null, 'quantity' => 1 ) ) );
	$request->set_param( 'billing', array( 'full_name' => 'Synthetic Checkout Audit', 'email' => $email, 'phone' => '+91 98765 43210', 'country' => 'IN', 'region' => '' ) );
	$request->set_header( 'Idempotency-Key', $key );
	$first = $checkout->prepare( $request );
	$first_data = $first instanceof WP_REST_Response ? $first->get_data() : array();
	$order_id = (int) ( $first_data['data']['id'] ?? 0 );
	if ( 201 !== $first->get_status() || 'complete' !== ( $first_data['data']['status'] ?? '' ) || 0 !== ( $first_data['data']['total']['amount'] ?? -1 ) || ! $order_id ) {
		throw new RuntimeException( 'Live free checkout did not return a completed zero-value order: ' . wp_json_encode( array( 'status' => $first->get_status(), 'body' => $first_data ) ) );
	}
	$order = edd_get_order( $order_id );
	$items = $order ? $order->get_items() : array();
	if ( ! $order || 'manual' !== $order->gateway || 1 !== count( $items ) || ! $items[0]->is_deliverable() ) {
		throw new RuntimeException( 'EDD order item was not authorized as deliverable after native completion.' );
	}
	if ( '+919876543210' !== edd_get_order_meta( $order_id, '_edd_phone', true ) || '+919876543210' !== edd_get_customer_meta( $order->customer_id, 'phone', true ) ) {
		throw new RuntimeException( 'EDD did not persist the normalized phone to order and customer metadata.' );
	}

	$retry = $checkout->prepare( $request );
	$retry_data = $retry instanceof WP_REST_Response ? $retry->get_data() : array();
	if ( 200 !== $retry->get_status() || $order_id !== (int) ( $retry_data['data']['id'] ?? 0 ) ) {
		throw new RuntimeException( 'Identical retry did not reuse the same completed EDD order.' );
	}
	$customer_id = (int) $order->customer_id;
	printf( "Live EDD zero-order check passed: order %d completed, item deliverable, retry reused order.\n", $order_id );
} finally {
	if ( $order_id && edd_get_order( $order_id ) ) {
		edd_delete_purchase( $order_id, true, false );
	}
	if ( $customer_id ) {
		$customer = edd_get_customer( $customer_id );
		if ( $customer && empty( $customer->payment_ids ) ) {
			edd_destroy_customer( $customer_id );
		}
	}
	if ( function_exists( 'delete_transient' ) ) {
		$scope = 'guest|' . strtolower( $email );
		$digest = hash_hmac( 'sha256', $scope . '|' . strtolower( $key ), wp_salt( 'auth' ) );
		delete_transient( 'ch_checkout_' . substr( $digest, 0, 40 ) );
	}
	if ( false !== $receipt_priority ) {
		add_action( 'edd_complete_purchase', 'edd_trigger_purchase_receipt', $receipt_priority );
	}
}

if ( edd_get_customer_by( 'email', $email ) || edd_count_orders( array( 'type' => 'sale' ) ) !== $orders_before ) {
	fwrite( STDERR, "Synthetic EDD order/customer cleanup could not be verified.\n" );
	exit( 1 );
}
