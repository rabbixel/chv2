<?php
$_SERVER['REQUEST_SCHEME'] = 'http';
$_SERVER['HTTP_HOST'] = 'creativehatti.test';
require 'C:/laragon/www/creativehatti/wp-load.php';
require ABSPATH . 'wp-admin/includes/template.php';
wp_set_current_user( 1 );
if ( ! current_user_can( 'manage_options' ) ) { echo "ADMIN_CAPABILITY_MISSING\n"; exit( 2 ); }
$_GET['settings-updated'] = 'true';
ob_start();
CH_Home_Sections::render_settings_page();
$html = ob_get_clean();
$events = array();
preg_match_all( '/<form\b[^>]*>|<\/form>/i', $html, $matches, PREG_OFFSET_CAPTURE );
$depth = 0;
$nested = false;
foreach ( $matches[0] as $match ) {
	if ( 0 === stripos( $match[0], '</form' ) ) { --$depth; }
	else { if ( $depth > 0 ) { $nested = true; } ++$depth; }
	$events[] = array( $match[0], $match[1], $depth );
}
$settings_open = strpos( $html, '<form id="ch-home-settings-form"' );
$preview_open = strpos( $html, '<form', 0 );
$preview_close = false !== $preview_open ? strpos( $html, '</form>', $preview_open ) : false;
$settings_close = false !== $settings_open ? strpos( $html, '</form>', $settings_open ) : false;
$save_button = strpos( $html, 'id="submit"' );
$success = false !== strpos( $html, 'Homepage sections saved. The preview now reflects the saved settings.' );
echo wp_json_encode( array(
	'form_tags_balanced' => 0 === $depth,
	'forms_nested' => $nested,
	'preview_form_before_settings' => false !== $preview_open && false !== $preview_close && false !== $settings_open && $preview_close < $settings_open,
	'save_button_inside_settings_form' => false !== $settings_open && false !== $save_button && false !== $settings_close && $settings_open < $save_button && $save_button < $settings_close,
	'success_notice_visible_after_settings_update' => $success,
	'saved_option_preview' => class_exists( 'CH_Home_Sections' ) ? array_column( CH_Home_Sections::get_homepage_sections()->data['data']['featured_packs'], 'title' ) : array(),
) );
