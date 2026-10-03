<?php
/**
 * Plugin Name: Creative Hatti Local Media Preview
 * Description: Show original images in the local Media Library when imported thumbnail files are absent.
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
 exit;
}

add_filter( 'wp_prepare_attachment_for_js', function ( $response, $attachment, $metadata ) {
 // This repair is deliberately limited to the local WordPress admin.
 $host = wp_parse_url( home_url(), PHP_URL_HOST );
 if ( ! is_admin() || ! in_array( $host, array( 'creativehatti.test', 'www.creativehatti.test' ), true ) ) {
  return $response;
 }
 if ( ! is_array( $response ) || empty( $response['sizes']['full'] ) || ! is_array( $metadata ) ) {
  return $response;
 }
 $original = get_attached_file( $attachment->ID );
 if ( ! $original || ! is_file( $original ) ) {
  return $response;
 }
 foreach ( $response['sizes'] as $name => $size ) {
  if ( 'full' === $name || empty( $metadata['sizes'][ $name ]['file'] ) ) {
   continue;
  }
  $filename = wp_basename( $metadata['sizes'][ $name ]['file'] );
  if ( ! is_file( dirname( $original ) . '/' . $filename ) ) {
   // Keep the real dimensions and URL together; do not modify attachment metadata.
   $response['sizes'][ $name ] = $response['sizes']['full'];
  }
 }
 return $response;
}, 20, 3 );
