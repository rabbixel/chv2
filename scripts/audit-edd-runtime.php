<?php
/** Read-only local EDD checkout audit. Run with Laragon PHP; creates no records. */
$_SERVER['REQUEST_SCHEME'] = 'http';
$_SERVER['HTTP_HOST'] = 'creativehatti.test';
require 'C:/laragon/www/creativehatti/wp-load.php';

$result = array(
	'wordpress' => get_bloginfo( 'version' ),
	'edd_version' => defined( 'EDD_VERSION' ) ? EDD_VERSION : null,
	'currency' => function_exists( 'edd_get_currency' ) ? edd_get_currency() : null,
	'currency_decimals' => function_exists( 'edd_currency_decimal_filter' ) ? edd_currency_decimal_filter( 2 ) : 2,
	'use_taxes' => function_exists( 'edd_use_taxes' ) ? edd_use_taxes() : null,
	'item_quantities_enabled' => function_exists( 'edd_item_quantities_enabled' ) ? edd_item_quantities_enabled() : null,
	'prices_include_tax' => function_exists( 'edd_prices_include_tax' ) ? edd_prices_include_tax() : null,
	'round_tax_at_subtotal' => get_option( 'edd_round_tax_at_subtotal', null ),
	'products' => array(),
	'discounts' => array(),
);

$products = get_posts( array( 'post_type' => 'download', 'post_status' => 'publish', 'posts_per_page' => 100, 'orderby' => 'ID', 'order' => 'ASC', 'fields' => 'ids' ) );
$representatives = array( 'fixed' => false, 'free' => false, 'variable' => false );
$scan_offset = 0;
while ( true ) {
	if ( $scan_offset > 0 ) {
		$products = get_posts( array( 'post_type' => 'download', 'post_status' => 'publish', 'posts_per_page' => 500, 'offset' => $scan_offset, 'orderby' => 'ID', 'order' => 'ASC', 'fields' => 'ids' ) );
	}
	if ( empty( $products ) ) { break; }
	foreach ( $products as $id ) {
	$variable = function_exists( 'edd_has_variable_prices' ) && edd_has_variable_prices( $id );
	$base = function_exists( 'edd_get_download_price' ) ? edd_get_download_price( $id ) : get_post_meta( $id, 'edd_price', true );
	$kind = $variable ? 'variable' : ( (float) $base === 0.0 ? 'free' : 'fixed' );
	if ( ! $representatives[ $kind ] ) {
	$options = array();
	if ( $variable && function_exists( 'edd_get_variable_prices' ) ) {
		foreach ( (array) edd_get_variable_prices( $id ) as $price_id => $option ) {
			$options[] = array( 'id' => (int) $price_id, 'name' => (string) ( $option['name'] ?? '' ), 'amount' => (float) ( $option['amount'] ?? 0 ) );
		}
	}
	$result['products'][] = array( 'id' => (int) $id, 'title' => get_the_title( $id ), 'variable' => (bool) $variable, 'base_amount' => (float) $base, 'price_options' => $options );
	$representatives[ $kind ] = true;
	}
	}
	if ( ! empty( $representatives['fixed'] ) && ! empty( $representatives['free'] ) && ! empty( $representatives['variable'] ) ) { break; }
	$scan_offset += count( $products );
}

if ( function_exists( 'edd_get_discounts' ) ) {
	foreach ( (array) edd_get_discounts( array( 'number' => 200, 'orderby' => 'id', 'order' => 'ASC' ) ) as $discount ) {
		$result['discounts'][] = array(
			'id' => (int) $discount->id,
			'code' => (string) $discount->code,
			'status' => (string) $discount->status,
			'type' => (string) $discount->type,
			'amount' => (float) $discount->amount,
			'expiration' => (string) $discount->expiration,
			'minimum_amount' => (float) $discount->min_price,
			'product_restrictions' => $discount->product_reqs,
			'excluded_products' => $discount->excluded_products,
			'uses' => (int) $discount->use_count,
			'max_uses' => (int) $discount->max_uses,
		);
	}
}

echo wp_json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ), PHP_EOL;
