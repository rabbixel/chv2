<?php
$_SERVER['REQUEST_SCHEME'] = 'http';
$_SERVER['HTTP_HOST'] = 'creativehatti.test';
require 'C:/laragon/www/creativehatti/wp-load.php';
$settings = get_option( 'ch_home_sections', array() );
$settings = is_array( $settings ) ? $settings : array();
$pack_rows = isset( $settings['packs'] ) && is_array( $settings['packs'] ) ? $settings['packs'] : array();
$pack_titles = array_map( static function ( $row ) { return $row['title'] ?? ''; }, $pack_rows );
$preview = class_exists( 'CH_Home_Sections' )
	? CH_Home_Sections::get_homepage_sections()->data['data']['featured_packs']
	: array();
$preview_titles = array_map( static function ( $row ) { return $row['title'] ?? ''; }, $preview );
echo wp_json_encode( array(
	'home' => get_option( 'home' ),
	'siteurl' => get_option( 'siteurl' ),
	'plugin_active' => in_array( 'creative-hatti-home-sections/creative-hatti-home-sections.php', get_option( 'active_plugins', array() ), true ),
	'packs_enabled' => ! empty( $settings['packs_enabled'] ),
	'packs_mode' => $settings['packs_mode'] ?? 'legacy',
	'pack_titles' => array_values( $pack_titles ),
	'preview_titles' => array_values( $preview_titles ),
	'celebration_count' => isset( $settings['celebrations'] ) && is_array( $settings['celebrations'] ) ? count( $settings['celebrations'] ) : 0,
) );
