<?php
/** Focused tests for Homepage Sections Handpicked Packs; no database or network. */
define( 'ABSPATH', __DIR__ . '/' );
define( 'WEEK_IN_SECONDS', 604800 );

class WP_Error { public $code; public function __construct( $code = '' ) { $this->code = $code; } }
class WP_REST_Server { const READABLE = 'GET'; }
class WP_REST_Response { public $data; public $status; public function __construct( $data, $status = 200 ) { $this->data = $data; $this->status = $status; } }

function add_action() {}
function register_setting() {}
function register_rest_route() {}
function wp_enqueue_media() { $GLOBALS['media_enqueue_count'] = ( $GLOBALS['media_enqueue_count'] ?? 0 ) + 1; }
function wp_enqueue_style( $handle, $src, $deps = array(), $version = false ) { $GLOBALS['admin_style_enqueue'] = array( $handle, $src, $deps, $version ); }
function wp_enqueue_script( $handle, $src, $deps = array(), $version = false, $in_footer = false ) { $GLOBALS['admin_script_enqueue'] = array( $handle, $src, $deps, $version, $in_footer ); }
function plugin_dir_url( $file ) { return '/wp-content/plugins/creative-hatti-home-sections/'; }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function absint( $value ) { return abs( (int) $value ); }
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_textarea_field( $value ) { return sanitize_text_field( $value ); }
function esc_attr( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES, 'UTF-8' ); }
function esc_html( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES, 'UTF-8' ); }
function esc_html__( $value, $domain = '' ) { return esc_html( $value ); }
function esc_html_e( $value, $domain = '' ) { echo esc_html( $value ); }
function esc_url( $value ) { return esc_attr( $value ); }
function esc_textarea( $value ) { return esc_html( $value ); }
function checked( $checked, $current = true, $display = true ) { $result = $checked === $current ? 'checked="checked"' : ''; if ( $display ) { echo $result; } return $result; }
function selected( $selected, $current = true, $display = true ) { $result = (string) $selected === (string) $current ? 'selected="selected"' : ''; if ( $display ) { echo $result; } return $result; }
function esc_url_raw( $url ) {
	$url = trim( (string) $url );
	return preg_match( '#^(https?://|/[^/])#i', $url ) ? $url : '';
}
function get_term( $id, $taxonomy = '' ) { return $GLOBALS['terms'][ (int) $id ] ?? false; }
function get_term_by( $field, $value, $taxonomy = '' ) { return false; }
function get_post_type( $id ) { return 100 === (int) $id ? 'attachment' : ( 0 < (int) $id ? 'download' : false ); }
function get_post_status( $id ) { return 'publish'; }
function wp_attachment_is_image( $id ) { return 100 === (int) $id; }
function wp_get_attachment_image_src( $id, $size = '' ) { if ( 100 === (int) $id ) { return array( 'https://media.example.test/pack.jpg', 1200, 720 ); } if ( 110 <= (int) $id && 114 >= (int) $id ) { return array( 'https://media.example.test/default-' . (int) $id . '.jpg', 640, 420 ); } return false; }
function get_post_meta( $id, $key, $single = true ) { return 'Seasonal cover'; }
function add_settings_error( $setting, $code, $message ) { $GLOBALS['settings_errors'][] = $code; }
function delete_transient() {}
function taxonomy_exists( $taxonomy ) { return true; }
function get_option( $key, $default = array() ) { return $GLOBALS['options'][ $key ] ?? $default; }
function get_transient() { return array(); }
function set_transient() {}
function update_option( $key, $value ) { $GLOBALS['options'][ $key ] = $value; return true; }
function get_posts( $args = array() ) { return $GLOBALS['hero_default_posts'] ?? array(); }
function get_post_thumbnail_id( $post_id = 0 ) { return 201 <= (int) $post_id && 205 >= (int) $post_id ? (int) $post_id - 91 : 0; }
function get_page_by_path() { return false; }
function admin_url( $path = '' ) { return $path; }
function __( $text, $domain = '' ) { return $text; }
function sanitize_key( $value ) { return strtolower( preg_replace( '/[^a-z0-9_-]/', '', (string) $value ) ); }
function sanitize_title( $value ) { return trim( strtolower( preg_replace( '/[^a-z0-9]+/i', '-', (string) $value ) ), '-' ); }
function wp_strip_all_tags( $value ) { return strip_tags( (string) $value ); }

$GLOBALS['terms'] = array(
	1 => (object) array( 'term_id' => 1, 'slug' => 'social-media', 'name' => 'Social Media', 'description' => 'Social templates', 'count' => 10 ),
	2 => (object) array( 'term_id' => 2, 'slug' => 'diwali', 'name' => 'Diwali', 'description' => 'Diwali designs', 'count' => 20 ),
	3 => (object) array( 'term_id' => 3, 'slug' => 'holi', 'name' => 'Holi', 'description' => 'Holi designs', 'count' => 15 ),
	4 => (object) array( 'term_id' => 4, 'slug' => 'logos', 'name' => 'Logos', 'description' => 'Logo templates', 'count' => 8 ),
	5 => (object) array( 'term_id' => 5, 'slug' => 'banners', 'name' => 'Banners', 'description' => 'Banner templates', 'count' => 9 ),
);
$GLOBALS['settings_errors'] = array();
require_once __DIR__ . '/../wordpress/creative-hatti-home-sections/creative-hatti-home-sections.php';

function check( $condition, $message ) {
	if ( ! $condition ) { fwrite( STDERR, "FAIL: {$message}\n" ); exit( 1 ); }
	++$GLOBALS['assertions'];
}

$GLOBALS['assertions'] = 0;
CH_Home_Sections::enqueue_admin_assets( 'settings_page_ch-home-sections' );
check( array( 'jquery' ) === $GLOBALS['admin_script_enqueue'][2], 'Hero tabs retain jQuery as the admin script dependency' );
check( (string) filemtime( __DIR__ . '/../wordpress/creative-hatti-home-sections/admin.js' ) === $GLOBALS['admin_script_enqueue'][3], 'admin JavaScript URL version tracks its file modification time' );
check( (string) filemtime( __DIR__ . '/../wordpress/creative-hatti-home-sections/admin.css' ) === $GLOBALS['admin_style_enqueue'][3], 'admin stylesheet URL version tracks its file modification time' );
$legacy = CH_Home_Sections::sanitize_settings( array(
	'packs_enabled' => '1',
	'packs' => array( array( 'category_id' => 1, 'title' => 'Social Media', 'blurb' => 'Social templates', 'image_id' => 100 ) ),
	'discovery_enabled' => '1', 'celebrations_enabled' => '1', 'trusted_enabled' => '0',
) );
check( true === $legacy['packs_enabled'], 'preserves the existing section enabled flag' );
check( 'manual' === $legacy['packs_mode'] && 5 === $legacy['packs_max_visible'], 'legacy configuration migrates to Manual mode and a five-card cap' );
check( 1 === count( $legacy['packs'] ) && 'social-media' === $GLOBALS['terms'][1]->slug, 'keeps the saved Social Media pack row' );
check( true === $legacy['packs'][0]['enabled'] && 'evergreen' === $legacy['packs'][0]['display_mode'], 'legacy cards remain enabled evergreen cards' );
check( 100 === $legacy['packs'][0]['image_id'], 'preserves the existing Media Library attachment ID' );
$render_row = new ReflectionMethod( 'CH_Home_Sections', 'render_pack_row' );
$render_row->setAccessible( true );
ob_start();
$render_row->invoke( null, 0, $legacy['packs'][0], array_values( $GLOBALS['terms'] ) );
$admin_html = ob_get_clean();
foreach ( array( '[enabled]', '[title]', '[blurb]', '[link_url]', '[display_mode]', '[start_date]', '[end_date]', '[priority]', '[annual]', '[image_id]' ) as $field ) {
	check( false !== strpos( $admin_html, $field ), 'admin row renders the ' . $field . ' control' );
}
check( false !== strpos( $admin_html, 'ch-home-select-image' ) && false !== strpos( $admin_html, 'pack.jpg' ), 'admin row uses the existing Media Library picker with a saved thumbnail preview' );

$rows = array(
	array( 'category_id' => 1, 'title' => 'Social Media', 'display_mode' => 'seasonal', 'start_date' => '2026-10-01', 'end_date' => '2026-10-31', 'priority' => 20 ),
	array( 'category_id' => 2, 'title' => 'Diwali', 'display_mode' => 'seasonal', 'start_date' => '2026-10-01', 'end_date' => '2026-10-31', 'priority' => 10 ),
	array( 'category_id' => 3, 'title' => 'Holi', 'display_mode' => 'seasonal', 'start_date' => '2026-03-01', 'end_date' => '2026-03-10', 'priority' => 100 ),
	array( 'category_id' => 4, 'title' => 'Logos', 'display_mode' => 'evergreen', 'priority' => 90 ),
	array( 'category_id' => 5, 'title' => 'Banners', 'display_mode' => 'evergreen', 'priority' => 5 ),
	array( 'category_id' => 1, 'title' => 'Duplicate Social', 'display_mode' => 'evergreen', 'priority' => 1 ),
	array( 'category_id' => 5, 'title' => 'Disabled', 'enabled' => false, 'display_mode' => 'evergreen', 'priority' => 100 ),
);
$selected = CH_Home_Sections::select_pack_rows( $rows, 'automatic', 3, '2026-10-20' );
check( 3 === count( $selected ), 'automatic mode fills its configured limit' );
check( array( 0, 1, 3 ) === array_column( $selected, 'index' ), 'active seasonal cards rank by priority before evergreen fill' );
check( ! in_array( 6, array_column( $selected, 'index' ), true ), 'disabled cards never appear' );
check( count( array_unique( array_column( $selected, 'key' ) ) ) === count( $selected ), 'duplicate destinations are removed' );
$evergreen_only = CH_Home_Sections::select_pack_rows( $rows, 'automatic', 5, '2026-12-15' );
check( ! array_filter( $evergreen_only, static function ( $entry ) { return 'seasonal' === ( $entry['row']['display_mode'] ?? '' ); } ), 'without an active festival, automatic mode shows evergreen entries only' );
$one_festival = CH_Home_Sections::select_pack_rows( array( $rows[0], $rows[3], $rows[4] ), 'automatic', 5, '2026-10-20' );
check( array( 0, 1, 2 ) === array_column( $one_festival, 'index' ), 'one active festival is followed by evergreen collections' );
$duplicate_urls = CH_Home_Sections::select_pack_rows( array(
	array( 'title' => 'Link One', 'link_url' => 'https://EXAMPLE.test/collection/' ),
	array( 'title' => 'Link Duplicate', 'link_url' => 'https://example.test/collection' ),
), 'manual', 5, '2026-10-20' );
check( 1 === count( $duplicate_urls ), 'equivalent URL destinations are deduplicated' );

$yearWindow = array( 'display_mode' => 'seasonal', 'start_date' => '2026-12-20', 'end_date' => '2027-01-05' );
check( CH_Home_Sections::pack_is_active( $yearWindow, '2027-01-01' ), 'year-specific windows crossing New Year stay active' );
check( ! CH_Home_Sections::pack_is_active( $yearWindow, '2027-01-06' ), 'year-specific windows expire after their end date' );
$annualWindow = array( 'display_mode' => 'seasonal', 'start_date' => '2026-12-20', 'end_date' => '2027-01-05', 'annual' => true );
check( CH_Home_Sections::pack_is_active( $annualWindow, '2030-01-02' ), 'annual fixed-date window repeats across New Year' );
check( ! CH_Home_Sections::pack_is_active( $annualWindow, '2030-02-01' ), 'annual window is inactive outside its month-day range' );

$manual = CH_Home_Sections::select_pack_rows( array(
	array( 'category_id' => 2, 'title' => 'Out of season', 'display_mode' => 'seasonal', 'start_date' => '2025-01-01', 'end_date' => '2025-01-02' ),
	array( 'category_id' => 4, 'title' => 'Evergreen' ),
), 'manual', 5, '2026-10-20' );
check( array( 0, 1 ) === array_column( $manual, 'index' ), 'Manual mode retains configured order and ignores seasonal windows' );

$plugin_source = file_get_contents( __DIR__ . '/../wordpress/creative-hatti-home-sections/creative-hatti-home-sections.php' );
$preview_call = strpos( $plugin_source, 'self::render_pack_preview( $settings );' );
$settings_form = strpos( $plugin_source, '<form id="ch-home-settings-form"' );
check( false !== $preview_call && false !== $settings_form && $preview_call > $settings_form, 'saved pack preview is now scoped to the Handpicked Packs tab' );
check( false === strpos( $plugin_source, '<form method="get"' ) && false !== strpos( $plugin_source, 'ch-home-preview-date' ), 'date preview uses a non-nested GET navigation control' );
check( false !== strpos( $plugin_source, 'method="post" action="options.php" novalidate' ), 'settings form submits through options.php and delegates inline validation to the plugin' );
$admin_js = file_get_contents( __DIR__ . '/../wordpress/creative-hatti-home-sections/admin.js' );
check( false !== strpos( $admin_js, '"#ch-home-settings-form"' ) && false !== strpos( $admin_js, 'validateSettingsForm' ), 'only the settings POST form receives row validation and submit handling' );
check( false !== strpos( $admin_js, 'ch-home-field-error' ) && false !== strpos( $admin_js, 'Show-from date must not be after' ), 'seasonal validation reports errors beside the affected fields' );
check( false !== strpos( $plugin_source, 'Homepage sections saved. The preview now reflects the saved settings.' ), 'successful options.php return displays a saved confirmation' );

$today = new DateTimeImmutable( 'now', new DateTimeZone( 'Asia/Kolkata' ) );
$start_date = $today->modify( '-1 day' )->format( 'Y-m-d' );
$end_date = $today->modify( '+3 days' )->format( 'Y-m-d' );
$save_input = array(
	'characters_enabled' => '1', 'characters' => array(),
	'packs_enabled' => '1', 'packs_mode' => 'automatic', 'packs_max_visible' => '3',
	'packs' => array( array( 'category_id' => 2, 'title' => 'Diwali', 'display_mode' => 'seasonal', 'start_date' => $start_date, 'end_date' => $end_date, 'priority' => '95', 'enabled' => '1' ) ),
	'discovery_enabled' => '1', 'discovery' => array(),
	'celebrations_enabled' => '1', 'celebrations' => array( array( 'title' => 'Diwali celebration', 'query' => 'Diwali', 'event_date' => $today->format( 'Y-m-d' ), 'show_from' => $start_date, 'hide_after' => $end_date, 'priority' => '88', 'pinned' => '1' ) ),
	'keywords_enabled' => '1', 'keywords' => 'Diwali', 'trusted_enabled' => '0',
);
$GLOBALS['options']['ch_home_sections'] = array( 'packs' => array( array( 'category_id' => 1, 'title' => 'Social Media' ) ), 'packs_enabled' => true );
$saved_settings = CH_Home_Sections::sanitize_settings( $save_input );
update_option( 'ch_home_sections', $saved_settings );
$refreshed_settings = get_option( 'ch_home_sections', array() );
check( 'automatic' === $refreshed_settings['packs_mode'] && 3 === $refreshed_settings['packs_max_visible'], 'WordPress option retains Handpicked Packs display settings after a fresh read' );
check( 1 === count( $refreshed_settings['packs'] ) && 'Diwali' === $refreshed_settings['packs'][0]['title'], 'WordPress option replaces the old Social Media pack with the saved Diwali pack' );
check( 'seasonal' === $refreshed_settings['packs'][0]['display_mode'] && $end_date === $refreshed_settings['packs'][0]['end_date'] && 95 === $refreshed_settings['packs'][0]['priority'], 'seasonal dates, display type and priority persist' );
check( 'Diwali celebration' === $refreshed_settings['celebrations'][0]['title'] && 88 === $refreshed_settings['celebrations'][0]['priority'], 'seasonal settings from another tab persist in the same option update' );
$refreshed_response = CH_Home_Sections::get_homepage_sections()->data['data'];
check( 1 === count( $refreshed_response['featured_packs'] ) && 'Diwali' === $refreshed_response['featured_packs'][0]['title'], 'homepage preview data reflects the newly saved Diwali pack' );
$preview_method = new ReflectionMethod( 'CH_Home_Sections', 'render_pack_preview' );
$preview_method->setAccessible( true );
ob_start();
$preview_method->invoke( null, $refreshed_settings );
$saved_preview_html = ob_get_clean();
check( false !== strpos( $saved_preview_html, 'Diwali' ) && false === strpos( $saved_preview_html, 'Social Media' ), 'saved admin preview updates and no longer shows the old Social Media pack' );

$GLOBALS['settings_errors'] = array();
$invalid_input = $save_input;
$invalid_input['celebrations'][0]['show_from'] = $today->modify( '+4 days' )->format( 'Y-m-d' );
$invalid_settings = CH_Home_Sections::sanitize_settings( $invalid_input );
check( in_array( 'invalid_schedule', $GLOBALS['settings_errors'], true ), 'invalid seasonal row in another tab produces a visible settings error' );
check( 1 === count( $invalid_settings['packs'] ), 'valid Handpicked Packs are retained when another tab has an invalid seasonal row' );

$GLOBALS['options']['ch_home_sections'] = array(
	'packs_enabled' => true,
	'packs_mode' => 'manual',
	'packs_max_visible' => 5,
	'packs' => array( array( 'category_id' => 1, 'title' => 'Social Media', 'blurb' => 'Social templates', 'image_id' => 100, 'enabled' => true, 'display_mode' => 'evergreen' ) ),
	'discovery_enabled' => true, 'discovery' => array(),
	'celebrations_enabled' => true, 'celebrations' => array(),
	'keywords_enabled' => true, 'keywords' => 'Social Media',
	'trusted_enabled' => false,
);
$response = CH_Home_Sections::get_homepage_sections();
$data = $response->data['data'];
check( 200 === $response->status && true === $data['featured_packs_enabled'], 'REST endpoint returns the enabled Handpicked Packs section' );
check( 1 === count( $data['featured_packs'] ) && 'social-media' === $data['featured_packs'][0]['category_slug'], 'REST response preserves the existing Social Media collection' );
check( 'https://media.example.test/pack.jpg' === $data['featured_packs'][0]['image']['url'], 'REST response returns the persistent Media Library thumbnail' );
check( 'topical' === $data['featured_packs'][0]['kind'] && 1 === $data['featured_packs'][0]['sort_order'], 'REST response keeps evergreen collection ordering' );
$GLOBALS['options']['ch_home_sections']['packs'] = array( array( 'title' => 'External Collection', 'link_url' => 'https://example.test/creative/', 'image_id' => 100, 'enabled' => true ) );
$external_response = CH_Home_Sections::get_homepage_sections()->data['data']['featured_packs'][0];
check( 'https://example.test/creative/' === $external_response['url'] && '' === $external_response['category_slug'], 'REST response keeps valid custom destinations without requiring a category' );

$hero_input = array(
	'v2' => array( 'hero' => array(
		'enabled' => array( 'mode' => 'custom', 'value' => '0' ),
		'eyebrow' => array( 'mode' => 'custom', 'value' => 'Created for designers' ),
		'heading' => array( 'mode' => 'custom', 'value' => '' ),
		'images' => array(
			0 => array( 'mode' => 'custom', 'attachment_id' => '100', 'link_url' => '/collections/diwali' ),
			1 => array( 'mode' => 'custom', 'attachment_id' => '0' ),
		),
		'stats' => array( 0 => array( 'mode' => 'custom', 'value' => 'Editors', 'label' => 'Choice', 'visible' => '0' ) ),
	) ),
);
$hero_saved = CH_Home_Sections::sanitize_settings( $hero_input );
update_option( 'ch_home_sections', $hero_saved );
$hero_refreshed = get_option( 'ch_home_sections', array() );
check( 2 === $hero_refreshed['v2']['version'] && 'custom' === $hero_refreshed['v2']['hero']['heading']['mode'] && '' === $hero_refreshed['v2']['hero']['heading']['value'], 'Hero keeps an explicitly empty custom heading through save and refresh' );
check( 'custom' === $hero_refreshed['v2']['hero']['enabled']['mode'] && false === $hero_refreshed['v2']['hero']['enabled']['value'], 'Hero persists an explicit disabled state' );
check( 100 === $hero_refreshed['v2']['hero']['images'][0]['attachment_id'] && 0 === $hero_refreshed['v2']['hero']['images'][1]['attachment_id'], 'Hero saves one selected image and a separately cleared image slot' );
check( false === $hero_refreshed['v2']['hero']['stats'][0]['visible'], 'Hero statistics support explicit visibility state' );
$hero_render = new ReflectionMethod( 'CH_Home_Sections', 'render_hero_section' );
$hero_render->setAccessible( true );
$GLOBALS['hero_default_posts'] = array( 201, 202, 203, 204, 205 );
ob_start();
$hero_render->invoke( null, $hero_refreshed );
$hero_admin_html = ob_get_clean();
$GLOBALS['hero_default_posts'] = array();
foreach ( array( '[heading][mode]', '[images][0][attachment_id]', '[images][3][link_url]', '[stats][0][visible]', 'ch-home-hero-restore', 'Saved headline', 'role="tablist"', 'data-hero-tab="artwork"' ) as $control ) {
	check( false !== strpos( $hero_admin_html, $control ), 'Hero admin panel renders ' . $control );
}
check( false !== strpos( $hero_admin_html, 'aria-selected="true" tabindex="0" data-hero-tab="content"' ), 'Content is the accessible default Hero tab' );
check( false !== strpos( $hero_admin_html, 'data-hero-panel="content" aria-hidden="false" tabindex="0">' ), 'Content fields are visible in server-rendered Hero markup' );
check( false !== strpos( $hero_admin_html, 'data-hero-panel="artwork" aria-hidden="true" tabindex="0" hidden>' ) && false !== strpos( $hero_admin_html, 'data-hero-panel="statistics" aria-hidden="true" tabindex="0" hidden>' ), 'inactive Hero panels start hidden and marked as such for assistive technology' );
check( false !== strpos( $hero_admin_html, 'default-112.jpg' ), 'Hero artwork panel previews the effective default image when no override exists' );
check( false !== strpos( $hero_admin_html, 'ch-home-restore-image' ), 'custom artwork slots expose a Restore Default action' );
$hero_response = CH_Home_Sections::get_homepage_sections()->data['data']['homepage_config_v2'];
check( '' === $hero_response['hero']['heading']['value'] && false === $hero_response['hero']['enabled']['value'], 'public REST config preserves empty custom text and disabled section state' );
check( 'https://media.example.test/pack.jpg' === $hero_response['hero']['images'][0]['image']['url'] && null === $hero_response['hero']['images'][1]['image'], 'public REST config includes safe attachment DTOs and explicit cleared slots' );

// Older forms without the v2 field must not discard stored Homepage Manager data.
$legacy_post = array( 'packs_enabled' => '1', 'packs' => array(), 'characters_enabled' => '0', 'characters' => array() );
$legacy_resave = CH_Home_Sections::sanitize_settings( $legacy_post );
check( $hero_refreshed['v2'] === $legacy_resave['v2'], 'legacy settings submissions preserve the v2 configuration' );
$partial_resave = CH_Home_Sections::sanitize_settings( array( 'v2' => array( 'hero' => array( 'heading' => array( 'mode' => 'custom', 'value' => 'Changed heading' ) ) ) ) );
check( 'Changed heading' === $partial_resave['v2']['hero']['heading']['value'] && 'Created for designers' === $partial_resave['v2']['hero']['eyebrow']['value'], 'a field-only v2 update preserves unrelated Hero overrides' );

echo 'PASS: ' . $GLOBALS['assertions'] . " Handpicked Packs assertions\n";
