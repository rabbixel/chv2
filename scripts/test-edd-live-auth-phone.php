<?php
/** Authenticated phone prefill and checkout check using disposable local records. */
$_SERVER['REQUEST_SCHEME'] = 'http';
$_SERVER['HTTP_HOST'] = 'creativehatti.test';
require 'C:/laragon/www/creativehatti/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/user.php';

$email = 'au-' . substr( str_replace( '-', '', wp_generate_uuid4() ), 0, 12 ) . '@example.test';
$user_id = 0;
$customer_id = 0;
$order_id = 0;
$order_key = wp_generate_uuid4();
$orders_before = edd_count_orders( array( 'type' => 'sale' ) );

try {
	$user_id = wp_create_user( $email, wp_generate_password( 32 ), $email );
	if ( is_wp_error( $user_id ) || ! $user_id ) { throw new RuntimeException( 'Could not create a synthetic WordPress user.' ); }
	wp_update_user( array( 'ID' => $user_id, 'first_name' => 'Synthetic', 'last_name' => 'Member' ) );
	$customer_id = edd_add_customer( array( 'user_id' => $user_id, 'email' => $email, 'name' => 'Synthetic Member' ) );
	if ( ! $customer_id ) { throw new RuntimeException( 'Could not create a synthetic EDD customer.' ); }
	edd_update_customer_meta( $customer_id, 'phone', '+919876543210' );

	$profile_method = new ReflectionMethod( 'CH_Auth_Controller', 'safe_profile' );
	$profile_method->setAccessible( true );
	$profile = $profile_method->invoke( null, get_userdata( $user_id ) );
	if ( '+919876543210' !== ( $profile['phone'] ?? '' ) ) { throw new RuntimeException( 'Authenticated profile did not prefill the saved EDD phone.' ); }

	wp_set_current_user( $user_id );
	$cart = new CH_Cart_Controller( new CH_Auth_Controller() );
	$checkout = new CH_Checkout_Controller( new CH_Auth_Controller(), $cart );
	$request = new WP_REST_Request( 'POST', '/ch/v1/checkout/prepare' );
	$request->set_param( 'items', array( array( 'product_id' => 11152, 'price_id' => 2, 'quantity' => 1 ) ) );
	$request->set_param( 'billing', array( 'full_name' => 'Synthetic Member', 'email' => 'ignored@example.test', 'phone' => '+1 (415) 555-2671', 'country' => 'IN', 'region' => '' ) );
	$request->set_header( 'Idempotency-Key', $order_key );
	$response = $checkout->prepare( $request );
	$data = $response instanceof WP_REST_Response ? $response->get_data() : array();
	$order_id = (int) ( $data['data']['id'] ?? 0 );
	if ( 201 !== $response->get_status() || 'pending' !== ( $data['data']['status'] ?? '' ) || ! $order_id ) {
		throw new RuntimeException( 'Authenticated checkout did not prepare the expected pending order.' );
	}
	$order = edd_get_order( $order_id );
	if ( ! $order || (int) $order->user_id !== (int) $user_id || (int) $order->customer_id !== (int) $customer_id ) {
		throw new RuntimeException( 'Authenticated order was not attached to the matching user and EDD customer.' );
	}
	if ( '+14155552671' !== edd_get_order_meta( $order_id, '_edd_phone', true ) || '+14155552671' !== edd_get_customer_meta( $customer_id, 'phone', true ) ) {
		throw new RuntimeException( 'Authenticated checkout did not persist the submitted validated phone.' );
	}
	printf( "Live authenticated phone check passed: saved phone prefilled, order %d belongs to the synthetic account, new phone persisted.\n", $order_id );
} finally {
	wp_set_current_user( 0 );
	if ( $order_id && edd_get_order( $order_id ) ) { edd_delete_purchase( $order_id, true, false ); }
	if ( $customer_id && edd_get_customer( $customer_id ) ) { edd_destroy_customer( $customer_id ); }
	if ( $user_id && get_userdata( $user_id ) ) { wp_delete_user( $user_id ); }
	$digest = hash_hmac( 'sha256', 'user:' . $user_id . '|' . strtolower( $order_key ), wp_salt( 'auth' ) );
	delete_transient( 'ch_checkout_' . substr( $digest, 0, 40 ) );
}

if ( edd_count_orders( array( 'type' => 'sale' ) ) !== $orders_before || get_user_by( 'email', $email ) || edd_get_customer_by( 'email', $email ) ) {
	fwrite( STDERR, "Synthetic authenticated user, EDD customer, or order cleanup could not be verified.\n" );
	exit( 1 );
}
