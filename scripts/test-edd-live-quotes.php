<?php
/** Read-only live EDD quote checks. This script never calls checkout prepare. */
$_SERVER['REQUEST_SCHEME'] = 'http';
$_SERVER['HTTP_HOST'] = 'creativehatti.test';
require 'C:/laragon/www/creativehatti/wp-load.php';

$cart = new CH_Cart_Controller( new CH_Auth_Controller() );
$checkout = new CH_Checkout_Controller( new CH_Auth_Controller(), $cart );
$output = array();
$orders_before = function_exists( 'edd_count_orders' ) ? edd_count_orders( array( 'type' => 'sale' ) ) : null;
$cases = array(
	'fixed_price_ignores_tampered_amount' => array( array( 'product_id' => 2499, 'price_id' => null, 'quantity' => 1, 'unit_price' => 1 ) ),
	'variable_price_option_1' => array( array( 'product_id' => 11152, 'price_id' => 1, 'quantity' => 1 ) ),
	'variable_price_option_2' => array( array( 'product_id' => 11152, 'price_id' => 2, 'quantity' => 1 ) ),
	'multiple_products' => array( array( 'product_id' => 2499, 'price_id' => null, 'quantity' => 1 ), array( 'product_id' => 11152, 'price_id' => 2, 'quantity' => 2 ) ),
	'free_product' => array( array( 'product_id' => 2858, 'price_id' => null, 'quantity' => 1 ) ),
	'invalid_product' => array( array( 'product_id' => 999999999, 'price_id' => null, 'quantity' => 1 ) ),
	'invalid_option' => array( array( 'product_id' => 11152, 'price_id' => 99, 'quantity' => 1 ) ),
	'quantity_over_limit' => array( array( 'product_id' => 2499, 'price_id' => null, 'quantity' => 11 ) ),
	'empty_cart' => array(),
);
foreach ( $cases as $name => $items ) {
	$request = new WP_REST_Request( 'POST', '/ch/v1/checkout/quote' );
	$request->set_param( 'items', $items );
	$request->set_param( 'billing', array( 'country' => 'IN', 'region' => '', 'phone' => '+91 98765 43210' ) );
	$response = $checkout->quote( $request );
	$data = $response instanceof WP_REST_Response ? $response->get_data() : array();
	$output[ $name ] = array( 'http_status' => $response->get_status(), 'response' => $data );
}
foreach ( array( '400OFF' => 'active_coupon', 'NO_SUCH_COUPON' => 'invalid_coupon' ) as $code => $name ) {
	$request = new WP_REST_Request( 'POST', '/ch/v1/checkout/quote' );
	$request->set_param( 'items', array( array( 'product_id' => 2499, 'price_id' => null, 'quantity' => 1 ) ) );
	$request->set_param( 'billing', array( 'country' => 'IN', 'region' => '', 'phone' => '+91 98765 43210' ) );
	$request->set_param( 'discount_code', $code );
	$response = $checkout->quote( $request );
	$data = $response instanceof WP_REST_Response ? $response->get_data() : array();
	$output[ $name ] = array( 'http_status' => $response->get_status(), 'response' => $data );
}
$request = new WP_REST_Request( 'POST', '/ch/v1/checkout/quote' );
$request->set_param( 'items', array( array( 'product_id' => 2858, 'price_id' => null, 'quantity' => 1 ) ) );
$request->set_param( 'billing', array( 'country' => 'IN', 'region' => '', 'phone' => '+91 12345' ) );
$response = $checkout->quote( $request );
$output['invalid_phone'] = array( 'http_status' => $response->get_status() );
$failures = array();
$expected_totals = array(
	'fixed_price_ignores_tampered_amount' => 399900,
	'variable_price_option_1' => 399900,
	'variable_price_option_2' => 4900,
	'multiple_products' => 404800,
	'free_product' => 0,
	'active_coupon' => 0,
);
foreach ( $expected_totals as $name => $amount ) {
	$case = $output[ $name ] ?? array();
	if ( 200 !== ( $case['http_status'] ?? 0 ) || $amount !== ( $case['response']['data']['total']['amount'] ?? null ) ) {
		$failures[] = $name . ' expected HTTP 200 total ' . $amount;
	}
}
foreach ( array( 'invalid_product', 'invalid_option', 'quantity_over_limit', 'empty_cart', 'invalid_coupon', 'invalid_phone' ) as $name ) {
	if ( 422 !== ( $output[ $name ]['http_status'] ?? 0 ) ) { $failures[] = $name . ' expected HTTP 422'; }
}
$orders_after = function_exists( 'edd_count_orders' ) ? edd_count_orders( array( 'type' => 'sale' ) ) : null;
if ( null !== $orders_before && $orders_before !== $orders_after ) { $failures[] = 'zero-total checks must not create orders'; }
if ( $failures ) {
	fwrite( STDERR, 'Live EDD quote checks failed: ' . implode( '; ', $failures ) . PHP_EOL );
	exit( 1 );
}
echo 'Live EDD read-only quote checks passed: fixed/variable/multiple-product prices, tampered amount, quantity limits, free product, active/invalid coupon, invalid product/option, and invalid phone; orders unchanged (' . $orders_before . ').' . PHP_EOL;
