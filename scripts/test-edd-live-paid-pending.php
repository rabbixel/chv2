<?php
/** Live synthetic paid pending-order and idempotency integration check. */
$_SERVER['REQUEST_SCHEME'] = 'http';
$_SERVER['HTTP_HOST'] = 'creativehatti.test';
require 'C:/laragon/www/creativehatti/wp-load.php';

$email = 'pa-' . substr( str_replace( '-', '', wp_generate_uuid4() ), 0, 12 ) . '@example.test';
$key = wp_generate_uuid4();
if ( ! is_email( $email ) || edd_get_customer_by( 'email', $email ) ) {
	fwrite( STDERR, "Synthetic guest identity is invalid or already exists.\n" );
	exit( 1 );
}
$cart = new CH_Cart_Controller( new CH_Auth_Controller() );
$checkout = new CH_Checkout_Controller( new CH_Auth_Controller(), $cart );
$orders_before = edd_count_orders( array( 'type' => 'sale' ) );
$order_id = 0;
$customer_id = 0;
$items = array( array( 'product_id' => 11152, 'price_id' => 2, 'quantity' => 1 ) );
$billing = array( 'full_name' => 'Synthetic Paid Audit', 'email' => $email, 'phone' => '+91 98765 43210', 'country' => 'IN', 'region' => '' );
$request = new WP_REST_Request( 'POST', '/ch/v1/checkout/prepare' );
$request->set_param( 'items', $items );
$request->set_param( 'billing', $billing );
$request->set_header( 'Idempotency-Key', $key );

try {
	$first = $checkout->prepare( $request );
	$first_data = $first instanceof WP_REST_Response ? $first->get_data() : array();
	$order_id = (int) ( $first_data['data']['id'] ?? 0 );
	if ( 201 !== $first->get_status() || 'pending' !== ( $first_data['data']['status'] ?? '' ) || 4900 !== ( $first_data['data']['total']['amount'] ?? -1 ) || ! $order_id ) {
		throw new RuntimeException( 'Live paid checkout did not return the expected pending INR 49 order.' );
	}
	$order = edd_get_order( $order_id );
	$order_items = $order ? $order->get_items() : array();
	if ( ! $order || 'pending' !== $order->status || 1 !== count( $order_items ) || $order_items[0]->is_deliverable() ) {
		throw new RuntimeException( 'Pending paid order or its entitlement state was incorrect.' );
	}
	$customer_id = (int) $order->customer_id;

	$retry = $checkout->prepare( $request );
	$retry_data = $retry instanceof WP_REST_Response ? $retry->get_data() : array();
	if ( 200 !== $retry->get_status() || $order_id !== (int) ( $retry_data['data']['id'] ?? 0 ) ) {
		throw new RuntimeException( 'Identical paid retry did not reuse the pending order.' );
	}

	$changed = new WP_REST_Request( 'POST', '/ch/v1/checkout/prepare' );
	$changed->set_param( 'items', $items );
	$changed->set_param( 'billing', array_merge( $billing, array( 'phone' => '+447911123456' ) ) );
	$changed->set_header( 'Idempotency-Key', $key );
	$mismatch = $checkout->prepare( $changed );
	$mismatch_data = $mismatch instanceof WP_REST_Response ? $mismatch->get_data() : array();
	if ( 409 !== $mismatch->get_status() || 'idempotency_payload_mismatch' !== ( $mismatch_data['error']['code'] ?? '' ) ) {
		throw new RuntimeException( 'Changed payload reuse did not return HTTP 409.' );
	}
	printf( "Live paid-order check passed: pending order %d, no deliverable item, identical retry reused it, changed payload returned 409.\n", $order_id );
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
	$digest = hash_hmac( 'sha256', 'guest|' . strtolower( $email ) . '|' . strtolower( $key ), wp_salt( 'auth' ) );
	delete_transient( 'ch_checkout_' . substr( $digest, 0, 40 ) );
}

if ( edd_get_customer_by( 'email', $email ) || edd_count_orders( array( 'type' => 'sale' ) ) !== $orders_before ) {
	fwrite( STDERR, "Synthetic paid order/customer cleanup could not be verified.\n" );
	exit( 1 );
}
