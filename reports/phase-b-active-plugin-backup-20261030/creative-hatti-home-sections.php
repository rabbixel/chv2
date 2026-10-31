<?php
/**
 * Plugin Name: Creative Hatti Homepage Sections
 * Description: Curate homepage character and featured-pack cards from EDD categories.
 * Version: 1.1.0
 * Requires PHP: 7.4
 * Author: Creative Hatti
 * Text Domain: creative-hatti-home-sections
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/homepage-content.php';

final class CH_Home_Sections {
	const OPTION = 'ch_home_sections';
	const NAMESPACE = 'ch/v1';
	const TAXONOMY = 'download_category';
	const MAX_ROWS = 8;

	/**
	 * Register plugin hooks.
	 */
	public static function boot() {
		add_action( 'admin_menu', array( __CLASS__, 'add_settings_page' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_admin_assets' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/**
	 * Add the settings screen under Settings.
	 */
	public static function add_settings_page() {
		add_options_page(
			__( 'Homepage Sections', 'creative-hatti-home-sections' ),
			__( 'Homepage Sections', 'creative-hatti-home-sections' ),
			'manage_options',
			'ch-home-sections',
			array( __CLASS__, 'render_settings_page' )
		);
	}

	/**
	 * Register the single curated-content option.
	 */
	public static function register_settings() {
		register_setting(
			'ch_home_sections_group',
			self::OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( __CLASS__, 'sanitize_settings' ),
				'default'           => array(),
			)
		);
	}

	/**
	 * Enqueue the media picker only on this plugin's settings screen.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public static function enqueue_admin_assets( $hook ) {
		if ( 'settings_page_ch-home-sections' !== $hook ) {
			return;
		}

		wp_enqueue_media();
		$admin_css_path = __DIR__ . '/admin.css';
		$admin_js_path = __DIR__ . '/admin.js';
		$admin_css_version = file_exists( $admin_css_path ) ? (string) filemtime( $admin_css_path ) : '1.2.0';
		$admin_js_version = file_exists( $admin_js_path ) ? (string) filemtime( $admin_js_path ) : '1.2.0';
		wp_enqueue_style(
			'ch-home-sections-admin',
			plugin_dir_url( __FILE__ ) . 'admin.css',
			array(),
			$admin_css_version
		);
		wp_enqueue_script(
			'ch-home-sections-admin',
			plugin_dir_url( __FILE__ ) . 'admin.js',
			array( 'jquery' ),
			$admin_js_version,
			true
		);
	}

	/**
	 * Sanitize and validate submitted card settings.
	 *
	 * @param mixed $input Raw settings.
	 * @return array
	 */
	public static function sanitize_settings( $input ) {
		$input = is_array( $input ) ? $input : array();
		$existing = get_option( self::OPTION, array() );
		$existing = is_array( $existing ) ? $existing : array();
		$max_visible = absint( $input['packs_max_visible'] ?? 5 );
		if ( ! $max_visible ) {
			$max_visible = 5;
		}
		$output = array(
			'characters_enabled' => ! empty( $input['characters_enabled'] ),
			'packs_enabled'      => ! empty( $input['packs_enabled'] ),
			'characters'         => self::sanitize_rows( isset( $input['characters'] ) ? $input['characters'] : array() ),
			'packs'              => self::sanitize_rows( isset( $input['packs'] ) ? $input['packs'] : array(), true ),
			'packs_mode'         => in_array( $input['packs_mode'] ?? 'manual', array( 'manual', 'automatic' ), true ) ? ( $input['packs_mode'] ?? 'manual' ) : 'manual',
			'packs_max_visible'  => min( self::MAX_ROWS, max( 1, $max_visible ) ),
		);

		$output = array_merge( $output, CH_Home_Content::sanitize( $input ) );
		$output['v2'] = self::sanitize_v2( $input['v2'] ?? null, $existing['v2'] ?? array() );
		return $output;
	}

	/** Keep deliberate homepage overrides versioned without copying frontend defaults. */
	private static function sanitize_v2( $submitted, $existing ) {
		$submitted = is_array( $submitted ) ? $submitted : array();
		$existing = is_array( $existing ) ? $existing : array();
		$existing_hero = is_array( $existing['hero'] ?? null ) ? $existing['hero'] : array();
		$submitted_hero = is_array( $submitted['hero'] ?? null ) ? $submitted['hero'] : array();
		$hero_input = array_merge( $existing_hero, $submitted_hero );
		foreach ( array( 'images' => 4, 'stats' => 3 ) as $list_key => $list_limit ) {
			$hero_input[ $list_key ] = array();
			for ( $index = 0; $index < $list_limit; $index++ ) {
				$saved_row = is_array( $existing_hero[ $list_key ][ $index ] ?? null ) ? $existing_hero[ $list_key ][ $index ] : array();
				$posted_row = is_array( $submitted_hero[ $list_key ][ $index ] ?? null ) ? $submitted_hero[ $list_key ][ $index ] : array();
				$hero_input[ $list_key ][ $index ] = array_merge( $saved_row, $posted_row );
			}
		}
		$hero = array();
		$hero['enabled'] = self::sanitize_override( $hero_input['enabled'] ?? null, 'boolean', true );
		foreach ( array( 'eyebrow', 'heading', 'description', 'search_placeholder', 'search_button_text' ) as $field ) {
			$hero[ $field ] = self::sanitize_override( $hero_input[ $field ] ?? null, 'text' );
		}
		$hero['images'] = array();
		for ( $index = 0; $index < 4; $index++ ) {
			$image_input = $hero_input['images'][ $index ] ?? ( $hero_input['images'][ (string) ( $index + 1 ) ] ?? null );
			$image_input = is_array( $image_input ) ? $image_input : array();
			$mode = ( $image_input['mode'] ?? 'default' ) === 'custom' ? 'custom' : 'default';
			$image_id = absint( $image_input['attachment_id'] ?? 0 );
			if ( $image_id && ! self::image_dto( $image_id ) ) {
				add_settings_error( self::OPTION, 'invalid_hero_image_' . $index, __( 'A Hero image was ignored because it is not a usable image attachment.', 'creative-hatti-home-sections' ) );
				$image_id = 0;
			}
			$link_url = self::sanitize_pack_url( $image_input['link_url'] ?? '' );
			if ( 'custom' === $mode && ! empty( $image_input['link_url'] ) && ! $link_url ) {
				add_settings_error( self::OPTION, 'invalid_hero_link_' . $index, __( 'A Hero image destination must be an http(s) URL or a site-relative path.', 'creative-hatti-home-sections' ) );
			}
			$hero['images'][] = array(
				'mode' => $mode,
				'attachment_id' => 'custom' === $mode ? $image_id : 0,
				'link_url' => 'custom' === $mode ? $link_url : '',
			);
		}
		$hero['stats'] = array();
		for ( $index = 0; $index < 3; $index++ ) {
			$stat_input = $hero_input['stats'][ $index ] ?? array();
			$stat_input = is_array( $stat_input ) ? $stat_input : array();
			$mode = ( $stat_input['mode'] ?? 'default' ) === 'custom' ? 'custom' : 'default';
			$hero['stats'][] = array(
				'mode' => $mode,
				'value' => 'custom' === $mode ? sanitize_text_field( $stat_input['value'] ?? '' ) : '',
				'label' => 'custom' === $mode ? sanitize_text_field( $stat_input['label'] ?? '' ) : '',
				'visible' => ! array_key_exists( 'visible', $stat_input ) || ! empty( $stat_input['visible'] ),
			);
		}
		return array_merge( $existing, array( 'version' => 2, 'hero' => array_merge( $existing_hero, $hero ) ) );
	}

	/** Sanitize explicit default/custom field state; empty custom values stay empty. */
	private static function sanitize_override( $input, $type, $default = '' ) {
		$input = is_array( $input ) ? $input : array();
		$mode = ( $input['mode'] ?? 'default' ) === 'custom' ? 'custom' : 'default';
		$value = $default;
		if ( 'custom' === $mode ) {
			$value = 'boolean' === $type ? ! empty( $input['value'] ) : sanitize_textarea_field( $input['value'] ?? '' );
		}
		return array( 'mode' => $mode, 'value' => $value );
	}

	/**
	 * Validate repeater rows against EDD categories and the media library.
	 *
	 * @param mixed $rows Submitted rows.
	 * @return array
	 */
	private static function sanitize_rows( $rows, $is_pack = false ) {
		if ( ! is_array( $rows ) ) {
			return array();
		}

		$clean = array();
		$invalid_category = false;
		$invalid_pack_destination = false;
		$invalid_image = false;
		foreach ( array_slice( $rows, 0, self::MAX_ROWS ) as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}

			$term_id = isset( $row['category_id'] ) ? absint( $row['category_id'] ) : 0;
			$clean_title = sanitize_text_field( $row['title'] ?? '' );
			$link_url = $is_pack ? self::sanitize_pack_url( $row['link_url'] ?? '' ) : '';
			$query = $is_pack ? sanitize_text_field( $row['query'] ?? '' ) : '';
			if ( ! $term_id && empty( $row['title'] ) && empty( $row['blurb'] ) && empty( $row['image_id'] ) && ! $link_url && ! $query ) {
				continue;
			}

			$term = $term_id ? get_term( $term_id, self::TAXONOMY ) : null;
			if ( ( $term_id && ( ! $term || is_wp_error( $term ) ) ) || ( ! $term_id && ! $is_pack ) ) {
				$invalid_category = true;
				continue;
			}
			if ( ! $term_id && ! $link_url && ! $query ) {
				if ( $is_pack ) {
					$invalid_pack_destination = true;
				} else {
					$invalid_category = true;
				}
				continue;
			}
			if ( $is_pack && ! $clean_title && ! $term ) {
				add_settings_error( self::OPTION, 'invalid_pack_title', __( 'A Handpicked Pack was skipped because it needs a title.', 'creative-hatti-home-sections' ) );
				continue;
			}

			$image_id = isset( $row['image_id'] ) ? absint( $row['image_id'] ) : 0;
			if ( $image_id && ( 'attachment' !== get_post_type( $image_id ) || ! wp_attachment_is_image( $image_id ) ) ) {
				$image_id = 0;
				$invalid_image = true;
			}

			$artwork = isset( $row['artwork'] ) ? sanitize_key( $row['artwork'] ) : 'festival';
			if ( ! in_array( $artwork, self::artwork_variants(), true ) ) {
				$artwork = 'festival';
			}

			$clean_row = array(
				'category_id' => $term_id,
				'title'       => $clean_title,
				'blurb'       => isset( $row['blurb'] ) ? sanitize_textarea_field( $row['blurb'] ) : '',
				'hue'         => isset( $row['hue'] ) ? min( 360, max( 0, absint( $row['hue'] ) ) ) : 150,
				'artwork'     => $artwork,
				'image_id'    => $image_id,
			);
			if ( $is_pack ) {
				$requested_display_mode = $row['display_mode'] ?? 'evergreen';
				$display_mode = in_array( $requested_display_mode, array( 'seasonal', 'evergreen' ), true ) ? $requested_display_mode : 'evergreen';
				$start_date = CH_Home_Content::date_value( $row['start_date'] ?? '' );
				$end_date = CH_Home_Content::date_value( $row['end_date'] ?? '' );
				$annual = ! empty( $row['annual'] );
				if ( ( ! empty( $row['start_date'] ) && ! $start_date ) || ( ! empty( $row['end_date'] ) && ! $end_date ) || ( ! $annual && $start_date && $end_date && $start_date > $end_date ) ) {
					add_settings_error( self::OPTION, 'invalid_pack_dates', __( 'A Handpicked Pack was skipped because its dates are invalid or its end date precedes its start date.', 'creative-hatti-home-sections' ) );
					continue;
				}
				$clean_row['link_url'] = $link_url;
				$clean_row['query'] = $query;
				$clean_row['enabled'] = ! array_key_exists( 'enabled', $row ) || ! empty( $row['enabled'] );
				$clean_row['display_mode'] = $display_mode;
				$clean_row['start_date'] = $start_date;
				$clean_row['end_date'] = $end_date;
				$clean_row['annual'] = $annual;
				$clean_row['priority'] = min( 100, max( 0, (int) ( $row['priority'] ?? 0 ) ) );
			}
			$clean[] = $clean_row;
		}

		if ( $invalid_category ) {
			add_settings_error(
				self::OPTION,
				'invalid_category',
				__( 'One or more cards were skipped because their selected EDD category is no longer available.', 'creative-hatti-home-sections' ),
				'error'
			);
		}
		if ( $invalid_pack_destination ) {
			add_settings_error(
				self::OPTION,
				'invalid_pack_destination',
				__( 'A Handpicked Pack was skipped because it needs an EDD category, destination URL, or search query.', 'creative-hatti-home-sections' ),
				'error'
			);
		}
		if ( $invalid_image ) {
			add_settings_error(
				self::OPTION,
				'invalid_image',
				__( 'A selected thumbnail was not an image attachment and was removed.', 'creative-hatti-home-sections' ),
				'error'
			);
		}

		return $clean;
	}

	/** Validate a pack link without requiring the destination to be remotely reachable. */
	private static function sanitize_pack_url( $url ) {
		if ( ! is_string( $url ) ) {
			return '';
		}
		$url = trim( $url );
		if ( '' === $url ) {
			return '';
		}
		$url = esc_url_raw( $url );
		if ( ! $url ) {
			return '';
		}
		$parts = parse_url( $url );
		if ( false === $parts ) {
			return '';
		}
		if ( isset( $parts['scheme'] ) ) {
			return in_array( strtolower( $parts['scheme'] ), array( 'http', 'https' ), true ) && ! empty( $parts['host'] ) ? $url : '';
		}
		return isset( $url[0] ) && '/' === $url[0] && ( ! isset( $url[1] ) || '/' !== $url[1] ) ? $url : '';
	}

	/**
	 * Artwork names understood by the storefront's vector fallback.
	 *
	 * @return string[]
	 */
	private static function artwork_variants() {
		return array(
			'mythology',
			'profession',
			'cultural',
			'festival',
			'shivratri',
			'republic-day',
			'vasant-panchami',
			'valentine',
			'navratri',
		);
	}

	/**
	 * Render the curated card editor.
	 */
	public static function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to edit homepage sections.', 'creative-hatti-home-sections' ) );
		}

		$settings = get_option( self::OPTION, array() );
		$settings = is_array( $settings ) ? $settings : array();
		$terms = self::get_category_terms();
		$setting_errors = get_settings_errors( self::OPTION, false );
		$has_setting_errors = (bool) array_filter(
			$setting_errors,
			static function ( $error ) {
				return 'error' === ( $error['type'] ?? 'error' );
			}
		);
		$settings_updated = isset( $_GET['settings-updated'] ) && is_string( $_GET['settings-updated'] ) && 'true' === sanitize_text_field( wp_unslash( $_GET['settings-updated'] ) );
		$save_status = $has_setting_errors ? __( 'Fix the errors above. Changes were not confirmed as saved.', 'creative-hatti-home-sections' ) : ( $settings_updated ? __( 'Changes saved.', 'creative-hatti-home-sections' ) : __( 'Ready to edit.', 'creative-hatti-home-sections' ) );
		?>
		<div class="wrap ch-home-sections">
			<h1><?php esc_html_e( 'Creative Hatti Homepage Sections', 'creative-hatti-home-sections' ); ?></h1>
			<?php settings_errors( self::OPTION ); ?>
			<?php if ( $settings_updated && ! $has_setting_errors ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'Homepage sections saved. The preview now reflects the saved settings.', 'creative-hatti-home-sections' ); ?></p></div>
			<?php endif; ?>
			<p><?php esc_html_e( 'Manage the content and artwork shown across your Creative Hatti homepage.', 'creative-hatti-home-sections' ); ?></p>
			<?php if ( is_wp_error( $terms ) ) : ?>
				<div class="notice notice-error"><p><?php esc_html_e( 'EDD product categories are not available. Make sure Easy Digital Downloads is active.', 'creative-hatti-home-sections' ); ?></p></div>
			<?php endif; ?>
			<form id="ch-home-settings-form" class="ch-home-settings-form" method="post" action="options.php" novalidate>
				<?php settings_fields( 'ch_home_sections_group' ); ?>
			<nav class="ch-home-tabs" role="tablist" aria-label="Homepage sections">
				<?php foreach ( array( 'hero' => 'Hero', 'characters' => 'Character Categories', 'packs' => 'Handpicked Packs', 'discovery' => 'Collections', 'celebrations' => 'Celebrations', 'keywords' => 'Popular Themes', 'trusted' => 'Trusted Clients' ) as $tab => $label ) : ?>
					<button type="button" class="ch-home-tab" role="tab" id="ch-tab-<?php echo esc_attr( $tab ); ?>" aria-controls="ch-panel-<?php echo esc_attr( $tab ); ?>" data-tab="<?php echo esc_attr( $tab ); ?>"><?php echo esc_html( $label ); ?></button>
				<?php endforeach; ?>
			</nav>
			<?php self::render_hero_section( $settings ); ?>
			<?php self::render_section( 'characters', __( 'Character Categories', 'creative-hatti-home-sections' ), $settings, $terms ); ?>
			<?php self::render_packs_section( $settings, $terms ); ?>
				<?php CH_Home_Content::render( $settings, $terms ); ?>
				<div class="ch-home-savebar<?php echo $has_setting_errors ? ' is-error' : ''; ?>" aria-live="polite" aria-atomic="true"><span><?php echo esc_html( $save_status ); ?></span><?php submit_button( __( 'Save Changes', 'creative-hatti-home-sections' ), 'primary', 'submit', false ); ?></div>
			<div class="ch-home-drawer-backdrop" hidden></div>
			<aside class="ch-home-drawer" role="dialog" aria-modal="true" aria-labelledby="ch-home-drawer-title" hidden>
				<div class="ch-home-drawer-head"><h2 id="ch-home-drawer-title"><?php esc_html_e( 'Edit homepage item', 'creative-hatti-home-sections' ); ?></h2><button type="button" class="ch-home-drawer-close" aria-label="Close">&times;</button></div>
				<div class="ch-home-drawer-content"></div>
				<div class="ch-home-drawer-actions"><button type="button" class="button ch-home-drawer-cancel">Cancel</button><button type="button" class="button button-primary ch-home-drawer-apply">Apply</button></div>
			</aside>
			</form>
		</div>
		<?php
	}

	/** Hero settings are sparse overrides: Default always resolves in Next.js. */
	private static function render_hero_section( $settings ) {
		$hero = $settings['v2']['hero'] ?? array();
		$hero = is_array( $hero ) ? $hero : array();
		$defaults = array(
			'eyebrow' => "India's creative marketplace",
			'heading' => 'The Ultimate Collection of Indian Vector Assets',
			'description' => 'Characters, festival creatives, banners, bundles and ready-to-use templates — crafted with authentic Indian tadka for your next project.',
			'search_placeholder' => 'What are you searching for today…',
			'search_button_text' => 'Search',
		);
		$stats = array(
			array( '44,000+', 'Ready-to-use assets' ),
			array( '100+', 'Festival collections' ),
			array( 'Instant', 'Download & licence' ),
		);
		$featured_products = get_posts( array(
			'post_type' => 'download',
			'post_status' => 'publish',
			'posts_per_page' => 8,
			'fields' => 'ids',
			'no_found_rows' => true,
			'ignore_sticky_posts' => true,
			'orderby' => 'date',
			'order' => 'DESC',
			'meta_query' => array( array( 'key' => 'edd_feature_download', 'compare' => 'EXISTS' ) ),
		) );
		$default_previews = array();
		foreach ( (array) $featured_products as $product_id ) {
			$image_id = get_post_thumbnail_id( absint( $product_id ) );
			$source = $image_id ? wp_get_attachment_image_src( $image_id, 'medium' ) : false;
			if ( $source ) {
				$default_previews[] = array( 'id' => $image_id, 'url' => $source[0] );
			}
			if ( count( $default_previews ) >= 4 ) { break; }
		}
		?>
		<section class="ch-home-panel" id="ch-panel-hero" role="tabpanel" aria-labelledby="ch-tab-hero" data-panel="hero" hidden>
			<header class="ch-home-panel-head"><div><h2><?php esc_html_e( 'Hero & Search', 'creative-hatti-home-sections' ); ?></h2><p><?php esc_html_e( 'Manage the first impression of your storefront. Defaults preserve the current Next.js presentation.', 'creative-hatti-home-sections' ); ?></p></div></header>
			<div class="ch-home-hero-visibility">
				<div><strong><?php esc_html_e( 'Hero section visibility', 'creative-hatti-home-sections' ); ?></strong><p class="description"><?php esc_html_e( 'The Hero is visible by default. Disable it only with a Custom override.', 'creative-hatti-home-sections' ); ?></p></div>
				<?php self::render_v2_mode_select( 'hero][enabled', $hero['enabled']['mode'] ?? 'default', 'Visibility setting' ); ?>
				<label class="ch-home-enable"><input class="ch-home-hero-enable-value" type="hidden" name="ch_home_sections[v2][hero][enabled][value]" value="0"><input type="checkbox" name="ch_home_sections[v2][hero][enabled][value]" value="1" <?php checked( ( $hero['enabled']['mode'] ?? 'default' ) !== 'custom' || ! empty( $hero['enabled']['value'] ) ); ?>> <?php esc_html_e( 'Show Hero', 'creative-hatti-home-sections' ); ?></label>
			</div>
			<nav class="ch-home-subtabs" role="tablist" aria-label="Hero controls">
				<?php foreach ( array( 'content' => 'Content', 'artwork' => 'Artwork', 'statistics' => 'Statistics' ) as $tab => $label ) : ?>
					<button type="button" id="ch-hero-tab-<?php echo esc_attr( $tab ); ?>" class="ch-home-subtab<?php echo 'content' === $tab ? ' is-active' : ''; ?>" role="tab" aria-controls="ch-hero-panel-<?php echo esc_attr( $tab ); ?>" aria-selected="<?php echo 'content' === $tab ? 'true' : 'false'; ?>" tabindex="<?php echo 'content' === $tab ? '0' : '-1'; ?>" data-hero-tab="<?php echo esc_attr( $tab ); ?>"><?php echo esc_html( $label ); ?></button>
				<?php endforeach; ?>
			</nav>
			<div id="ch-hero-panel-content" class="ch-home-hero-subpanel" role="tabpanel" aria-labelledby="ch-hero-tab-content" data-hero-panel="content" aria-hidden="false" tabindex="0">
				<p class="description"><?php esc_html_e( 'Each field can use its current storefront default or an independent custom value.', 'creative-hatti-home-sections' ); ?></p>
				<div class="ch-home-hero-fields">
					<?php foreach ( $defaults as $field => $default ) : $saved = $hero[ $field ] ?? array(); $mode = $saved['mode'] ?? 'default'; $value = 'custom' === $mode ? ( $saved['value'] ?? '' ) : $default; $field_label = ucwords( str_replace( '_', ' ', $field ) ); $field_id = 'ch-hero-' . sanitize_key( $field ); ?>
						<div class="ch-home-hero-field">
							<div class="ch-home-hero-field-head"><label for="<?php echo esc_attr( $field_id ); ?>"><?php echo esc_html( $field_label ); ?></label><?php self::render_v2_mode_select( 'hero][' . $field, $mode, 'Override' ); ?></div>
							<?php if ( 'description' === $field ) : ?><textarea id="<?php echo esc_attr( $field_id ); ?>" class="widefat" rows="3" data-ch-default="<?php echo esc_attr( $default ); ?>" name="ch_home_sections[v2][hero][<?php echo esc_attr( $field ); ?>][value]"><?php echo esc_textarea( $value ); ?></textarea>
							<?php else : ?><input id="<?php echo esc_attr( $field_id ); ?>" class="widefat" type="text" data-ch-default="<?php echo esc_attr( $default ); ?>" name="ch_home_sections[v2][hero][<?php echo esc_attr( $field ); ?>][value]" value="<?php echo esc_attr( $value ); ?>"><?php endif; ?>
						</div>
					<?php endforeach; ?>
				</div>
				<div class="ch-home-hero-saved-preview"><strong><?php esc_html_e( 'Saved headline', 'creative-hatti-home-sections' ); ?></strong><p><?php echo esc_html( ( $hero['heading']['mode'] ?? 'default' ) === 'custom' ? ( $hero['heading']['value'] ?? '' ) : $defaults['heading'] ); ?></p><small><?php esc_html_e( 'This is the persisted value loaded when this page opened.', 'creative-hatti-home-sections' ); ?></small></div>
				<button type="button" class="button ch-home-hero-restore"><?php esc_html_e( 'Restore all Hero defaults', 'creative-hatti-home-sections' ); ?></button>
			</div>
			<div id="ch-hero-panel-artwork" class="ch-home-hero-subpanel" role="tabpanel" aria-labelledby="ch-hero-tab-artwork" data-hero-panel="artwork" aria-hidden="true" tabindex="0" hidden>
				<p class="description"><?php esc_html_e( 'Default previews match the current featured-product artwork. Custom with no image intentionally clears that slot.', 'creative-hatti-home-sections' ); ?></p>
				<div class="ch-home-hero-images">
					<?php for ( $index = 0; $index < 4; $index++ ) : $image = $hero['images'][ $index ] ?? array(); $image = is_array( $image ) ? $image : array(); $mode = $image['mode'] ?? 'default'; $image_id = absint( $image['attachment_id'] ?? 0 ); $custom_preview = $image_id ? wp_get_attachment_image_src( $image_id, 'medium' ) : false; $default_preview = $default_previews[ $index ] ?? array(); $preview_url = 'custom' === $mode ? ( $custom_preview ? $custom_preview[0] : '' ) : ( $default_preview['url'] ?? '' ); ?>
						<div class="ch-home-hero-image" data-mode="<?php echo esc_attr( $mode ); ?>" data-default-id="<?php echo esc_attr( $default_preview['id'] ?? 0 ); ?>" data-default-src="<?php echo esc_url( $default_preview['url'] ?? '' ); ?>">
							<div class="ch-home-hero-image-head"><strong><?php echo esc_html( sprintf( __( 'Hero image %d', 'creative-hatti-home-sections' ), $index + 1 ) ); ?></strong><?php self::render_v2_mode_select( 'hero][images][' . $index, $mode, 'Override' ); ?></div>
							<div class="ch-home-hero-preview-frame"><img class="ch-home-image-preview" src="<?php echo esc_url( $preview_url ); ?>" alt="" <?php echo $preview_url ? '' : 'hidden'; ?>><span class="ch-home-image-empty" <?php echo $preview_url ? 'hidden' : ''; ?>><?php esc_html_e( 'No image selected for this slot.', 'creative-hatti-home-sections' ); ?></span></div>
							<p class="description ch-home-image-state"><?php echo esc_html( 'custom' === $mode ? ( $custom_preview ? 'Custom image override' : 'Custom image cleared' ) : ( $preview_url ? 'Effective default image' : 'No default image available' ) ); ?></p>
							<input type="hidden" class="ch-home-image-id" name="ch_home_sections[v2][hero][images][<?php echo esc_attr( $index ); ?>][attachment_id]" value="<?php echo esc_attr( $image_id ); ?>">
							<label class="ch-home-destination"><?php esc_html_e( 'Optional destination URL', 'creative-hatti-home-sections' ); ?><input class="widefat" type="text" inputmode="url" name="ch_home_sections[v2][hero][images][<?php echo esc_attr( $index ); ?>][link_url]" value="<?php echo esc_attr( $image['link_url'] ?? '' ); ?>" placeholder="https:// or /path"></label>
							<div class="ch-home-artwork-actions"><button type="button" class="button button-primary ch-home-select-hero-image"><?php esc_html_e( 'Choose image', 'creative-hatti-home-sections' ); ?></button><button type="button" class="button ch-home-remove-hero-image" <?php echo 'custom' === $mode && $custom_preview ? '' : 'hidden'; ?>><?php esc_html_e( 'Clear image', 'creative-hatti-home-sections' ); ?></button><button type="button" class="button-link ch-home-restore-image" <?php echo 'custom' === $mode ? '' : 'hidden'; ?>><?php esc_html_e( 'Restore Default', 'creative-hatti-home-sections' ); ?></button></div>
						</div>
					<?php endfor; ?>
				</div>
			</div>
			<div id="ch-hero-panel-statistics" class="ch-home-hero-subpanel" role="tabpanel" aria-labelledby="ch-hero-tab-statistics" data-hero-panel="statistics" aria-hidden="true" tabindex="0" hidden>
				<p class="description"><?php esc_html_e( 'Customize each statistic independently. Restore a row to its current default by selecting Default.', 'creative-hatti-home-sections' ); ?></p>
				<div class="ch-home-hero-stats">
					<?php foreach ( $stats as $index => $default ) : $stat = $hero['stats'][ $index ] ?? array(); $stat = is_array( $stat ) ? $stat : array(); $mode = $stat['mode'] ?? 'default'; ?>
						<div class="ch-home-hero-stat">
							<div class="ch-home-hero-stat-head"><strong><?php echo esc_html( sprintf( __( 'Statistic %d', 'creative-hatti-home-sections' ), $index + 1 ) ); ?></strong><?php self::render_v2_mode_select( 'hero][stats][' . $index, $mode, 'Override' ); ?></div>
							<label><?php esc_html_e( 'Value', 'creative-hatti-home-sections' ); ?><input class="widefat" type="text" data-ch-default="<?php echo esc_attr( $default[0] ); ?>" name="ch_home_sections[v2][hero][stats][<?php echo esc_attr( $index ); ?>][value]" value="<?php echo esc_attr( 'custom' === $mode ? ( $stat['value'] ?? '' ) : $default[0] ); ?>"></label>
							<label><?php esc_html_e( 'Label', 'creative-hatti-home-sections' ); ?><input class="widefat" type="text" data-ch-default="<?php echo esc_attr( $default[1] ); ?>" name="ch_home_sections[v2][hero][stats][<?php echo esc_attr( $index ); ?>][label]" value="<?php echo esc_attr( 'custom' === $mode ? ( $stat['label'] ?? '' ) : $default[1] ); ?>"></label>
							<input type="hidden" name="ch_home_sections[v2][hero][stats][<?php echo esc_attr( $index ); ?>][visible]" value="0"><label class="ch-home-stat-visible"><input type="checkbox" name="ch_home_sections[v2][hero][stats][<?php echo esc_attr( $index ); ?>][visible]" value="1" <?php checked( ! array_key_exists( 'visible', $stat ) || ! empty( $stat['visible'] ) ); ?>> <?php esc_html_e( 'Visible', 'creative-hatti-home-sections' ); ?></label>
						</div>
					<?php endforeach; ?>
				</div>
				<button type="button" class="button ch-home-hero-restore"><?php esc_html_e( 'Restore all Hero defaults', 'creative-hatti-home-sections' ); ?></button>
			</div>
		</section>
		<?php
	}

	private static function render_v2_mode_select( $path, $mode, $label ) {
		$parts = explode( '][', $path );
		$name = 'ch_home_sections[v2][' . implode( '][', $parts ) . '][mode]';
		?>
		<label class="ch-home-override-mode"><?php echo esc_html( $label ); ?>
			<select name="<?php echo esc_attr( $name ); ?>"><option value="default" <?php selected( $mode, 'default' ); ?>><?php esc_html_e( 'Default', 'creative-hatti-home-sections' ); ?></option><option value="custom" <?php selected( $mode, 'custom' ); ?>><?php esc_html_e( 'Custom', 'creative-hatti-home-sections' ); ?></option></select>
		</label>
		<?php
	}

	/** Render a date preview of the saved Handpicked Packs configuration. */
	private static function render_pack_preview( $settings ) {
		$india_today = ( new DateTimeImmutable( 'now', new DateTimeZone( 'Asia/Kolkata' ) ) )->format( 'Y-m-d' );
		$requested_date = isset( $_GET['ch_preview_date'] ) && is_string( $_GET['ch_preview_date'] ) ? sanitize_text_field( wp_unslash( $_GET['ch_preview_date'] ) ) : $india_today;
		$preview_date = CH_Home_Content::date_value( $requested_date ) ?: $india_today;
		$preview_rows = ! empty( $settings['packs_enabled'] )
			? self::select_pack_rows( $settings['packs'] ?? array(), $settings['packs_mode'] ?? 'manual', $settings['packs_max_visible'] ?? 5, $preview_date )
			: array();
		?>
		<section class="ch-home-pack-preview" aria-labelledby="ch-home-pack-preview-title">
			<div class="ch-home-pack-preview-head">
				<div><h2 id="ch-home-pack-preview-title"><?php esc_html_e( 'Preview Handpicked Packs', 'creative-hatti-home-sections' ); ?></h2><p><?php esc_html_e( 'Preview the saved configuration for a date in Asia/Kolkata. Save pending edits before previewing them.', 'creative-hatti-home-sections' ); ?></p></div>
				<div class="ch-home-pack-preview-controls">
					<label for="ch-home-pack-preview-date"><?php esc_html_e( 'Date', 'creative-hatti-home-sections' ); ?></label>
					<input id="ch-home-pack-preview-date" type="date" value="<?php echo esc_attr( $preview_date ); ?>" required>
					<button type="button" class="button ch-home-preview-date"><?php esc_html_e( 'Preview saved date', 'creative-hatti-home-sections' ); ?></button>
				</div>
			</div>
			<p class="description"><?php echo esc_html( sprintf( __( '%1$d collections selected in %2$s mode, up to %3$d cards.', 'creative-hatti-home-sections' ), count( $preview_rows ), ( $settings['packs_mode'] ?? 'manual' ) === 'automatic' ? 'Automatic' : 'Manual', min( self::MAX_ROWS, max( 1, absint( $settings['packs_max_visible'] ?? 5 ) ) ) ) ); ?></p>
			<?php if ( $preview_rows ) : ?><ul class="ch-home-pack-preview-list">
				<?php foreach ( $preview_rows as $entry ) : $row = $entry['row']; $term = $entry['term']; $title = ! empty( $row['title'] ) ? $row['title'] : ( $term ? $term->name : __( 'Untitled collection', 'creative-hatti-home-sections' ) ); $image = ! empty( $row['image_id'] ) ? self::image_dto( absint( $row['image_id'] ) ) : null; ?>
					<li><?php if ( $image ) : ?><img src="<?php echo esc_url( $image['url'] ); ?>" alt="" width="56" height="42"><?php endif; ?><span><?php echo esc_html( $title ); ?></span><small><?php echo esc_html( 'seasonal' === ( $row['display_mode'] ?? 'evergreen' ) ? 'Seasonal' : 'Evergreen' ); ?></small></li>
				<?php endforeach; ?>
			</ul><?php else : ?><p><?php esc_html_e( 'No enabled, valid collections are selected for this date.', 'creative-hatti-home-sections' ); ?></p><?php endif; ?>
		</section>
		<?php
	}

	/** Render the dedicated Handpicked Packs tab without changing legacy option names. */
	private static function render_packs_section( $settings, $terms ) {
		$rows = isset( $settings['packs'] ) && is_array( $settings['packs'] ) ? array_values( $settings['packs'] ) : array();
		if ( ! $rows ) {
			$rows = array( array() );
		}
		$requested_mode = $settings['packs_mode'] ?? 'manual';
		$mode = in_array( $requested_mode, array( 'manual', 'automatic' ), true ) ? $requested_mode : 'manual';
		$max_visible = min( self::MAX_ROWS, max( 1, absint( $settings['packs_max_visible'] ?? 5 ) ) );
		?>
		<section class="ch-home-panel" id="ch-panel-packs" role="tabpanel" aria-labelledby="ch-tab-packs" data-panel="packs" hidden>
			<header class="ch-home-panel-head"><div><h2><?php esc_html_e( 'Handpicked Packs', 'creative-hatti-home-sections' ); ?></h2><p><?php esc_html_e( 'Prepare seasonal campaigns and evergreen collections in advance.', 'creative-hatti-home-sections' ); ?></p></div><label class="ch-home-enable"><input type="checkbox" name="ch_home_sections[packs_enabled]" value="1" <?php checked( ! empty( $settings['packs_enabled'] ) ); ?>> <?php esc_html_e( 'Enabled', 'creative-hatti-home-sections' ); ?></label></header>
			<?php self::render_pack_preview( $settings ); ?>
			<div class="ch-home-pack-controls">
				<label><?php esc_html_e( 'Display mode', 'creative-hatti-home-sections' ); ?><select name="ch_home_sections[packs_mode]"><option value="manual" <?php selected( $mode, 'manual' ); ?>><?php esc_html_e( 'Manual order', 'creative-hatti-home-sections' ); ?></option><option value="automatic" <?php selected( $mode, 'automatic' ); ?>><?php esc_html_e( 'Automatic seasonal rotation', 'creative-hatti-home-sections' ); ?></option></select></label>
				<label><?php esc_html_e( 'Maximum visible cards', 'creative-hatti-home-sections' ); ?><input type="number" min="1" max="<?php echo esc_attr( self::MAX_ROWS ); ?>" name="ch_home_sections[packs_max_visible]" value="<?php echo esc_attr( $max_visible ); ?>"></label>
			</div>
			<p class="description"><?php esc_html_e( 'Automatic mode ranks active seasonal cards by priority, then fills remaining slots with evergreen cards. Manual mode follows the row order and ignores schedules. Use explicit dates for movable festivals; annual recurrence is intended for fixed-date campaigns. All dates use Asia/Kolkata.', 'creative-hatti-home-sections' ); ?></p>
			<div class="ch-home-rows" data-section="packs" data-limit="<?php echo esc_attr( self::MAX_ROWS ); ?>">
				<?php foreach ( $rows as $index => $row ) { self::render_pack_row( $index, $row, $terms ); } ?>
			</div>
			<?php if ( ! is_wp_error( $terms ) ) : ?><button type="button" class="button ch-home-add-row" data-section="packs"><?php esc_html_e( 'Add collection', 'creative-hatti-home-sections' ); ?></button><?php endif; ?>
			<script type="text/html" id="ch-home-row-template-packs"><?php self::render_pack_row( '__INDEX__', array(), $terms ); ?></script>
		</section>
		<?php
	}

	/** Compact editor row for a scheduled or evergreen pack. */
	private static function render_pack_row( $index, $row, $terms ) {
		$prefix = self::OPTION . '[packs][' . $index . ']';
		$term_id = absint( $row['category_id'] ?? 0 );
		$term = $term_id ? get_term( $term_id, self::TAXONOMY ) : false;
		if ( $term && is_wp_error( $term ) ) { $term = false; }
		$image = ! empty( $row['image_id'] ) ? wp_get_attachment_image_src( absint( $row['image_id'] ), 'thumbnail' ) : false;
		$title = ! empty( $row['title'] ) ? $row['title'] : ( $term ? $term->name : __( 'New collection', 'creative-hatti-home-sections' ) );
		$requested_mode = $row['display_mode'] ?? 'evergreen';
		$mode = in_array( $requested_mode, array( 'seasonal', 'evergreen' ), true ) ? $requested_mode : 'evergreen';
		?>
		<div class="ch-home-row ch-home-pack-row">
			<div class="ch-home-row-summary"><img class="ch-home-row-thumb" src="<?php echo esc_url( $image ? $image[0] : '' ); ?>" alt="" <?php echo $image ? '' : 'hidden'; ?>><div class="ch-home-row-copy"><strong class="ch-home-row-title"><?php echo esc_html( $title ); ?></strong><span class="ch-home-row-subtitle"><?php echo esc_html( $term ? $term->name : ( $row['blurb'] ?? 'Collection destination required' ) ); ?></span></div><label class="ch-home-row-enabled"><input type="checkbox" name="<?php echo esc_attr( $prefix . '[enabled]' ); ?>" value="1" <?php checked( ! array_key_exists( 'enabled', $row ) || ! empty( $row['enabled'] ) ); ?>><?php esc_html_e( 'Enabled', 'creative-hatti-home-sections' ); ?></label><div class="ch-home-row-actions"><button type="button" class="button ch-home-edit-row"><?php esc_html_e( 'Edit', 'creative-hatti-home-sections' ); ?></button><button type="button" class="button-link ch-home-move-up" aria-label="Move up">↑</button><button type="button" class="button-link ch-home-move-down" aria-label="Move down">↓</button><button type="button" class="button-link-delete ch-home-remove-row"><?php esc_html_e( 'Remove', 'creative-hatti-home-sections' ); ?></button></div></div>
			<div class="ch-home-row-editor" hidden><div class="inside">
				<p><label><?php esc_html_e( 'Collection title', 'creative-hatti-home-sections' ); ?><input class="widefat" type="text" name="<?php echo esc_attr( $prefix . '[title]' ); ?>" value="<?php echo esc_attr( $row['title'] ?? '' ); ?>"></label></p>
				<p><label><?php esc_html_e( 'Short description', 'creative-hatti-home-sections' ); ?><textarea class="widefat" rows="2" name="<?php echo esc_attr( $prefix . '[blurb]' ); ?>"><?php echo esc_textarea( $row['blurb'] ?? '' ); ?></textarea></label></p>
				<p><label><?php esc_html_e( 'EDD category (optional when using a link or search query)', 'creative-hatti-home-sections' ); ?><select class="widefat" name="<?php echo esc_attr( $prefix . '[category_id]' ); ?>"><option value=""><?php esc_html_e( 'Choose a category', 'creative-hatti-home-sections' ); ?></option><?php if ( ! is_wp_error( $terms ) ) : foreach ( $terms as $available_term ) : ?><option value="<?php echo esc_attr( $available_term->term_id ); ?>" <?php selected( $term_id, $available_term->term_id ); ?>><?php echo esc_html( $available_term->name . ' (' . $available_term->slug . ')' ); ?></option><?php endforeach; endif; ?></select></label></p>
				<p><label><?php esc_html_e( 'Destination URL (optional)', 'creative-hatti-home-sections' ); ?><input class="widefat" type="text" inputmode="url" name="<?php echo esc_attr( $prefix . '[link_url]' ); ?>" value="<?php echo esc_attr( $row['link_url'] ?? '' ); ?>" placeholder="https:// or /collections/..."></label></p>
				<p><label><?php esc_html_e( 'Search query (optional)', 'creative-hatti-home-sections' ); ?><input class="widefat" type="text" name="<?php echo esc_attr( $prefix . '[query]' ); ?>" value="<?php echo esc_attr( $row['query'] ?? '' ); ?>"></label></p>
				<div class="ch-home-pack-schedule">
					<label><?php esc_html_e( 'Display type', 'creative-hatti-home-sections' ); ?><select name="<?php echo esc_attr( $prefix . '[display_mode]' ); ?>"><option value="evergreen" <?php selected( $mode, 'evergreen' ); ?>><?php esc_html_e( 'Evergreen', 'creative-hatti-home-sections' ); ?></option><option value="seasonal" <?php selected( $mode, 'seasonal' ); ?>><?php esc_html_e( 'Seasonal', 'creative-hatti-home-sections' ); ?></option></select></label>
					<label><?php esc_html_e( 'Start date', 'creative-hatti-home-sections' ); ?><input type="date" name="<?php echo esc_attr( $prefix . '[start_date]' ); ?>" value="<?php echo esc_attr( $row['start_date'] ?? '' ); ?>"></label>
					<label><?php esc_html_e( 'End date', 'creative-hatti-home-sections' ); ?><input type="date" name="<?php echo esc_attr( $prefix . '[end_date]' ); ?>" value="<?php echo esc_attr( $row['end_date'] ?? '' ); ?>"></label>
					<label><?php esc_html_e( 'Priority', 'creative-hatti-home-sections' ); ?><input type="number" min="0" max="100" name="<?php echo esc_attr( $prefix . '[priority]' ); ?>" value="<?php echo esc_attr( $row['priority'] ?? 0 ); ?>"></label>
				</div>
				<p><label><input type="checkbox" name="<?php echo esc_attr( $prefix . '[annual]' ); ?>" value="1" <?php checked( ! empty( $row['annual'] ) ); ?>><?php esc_html_e( 'Repeat annually (fixed-date campaigns only)', 'creative-hatti-home-sections' ); ?></label></p>
				<details class="ch-home-advanced"><summary><?php esc_html_e( 'Artwork options', 'creative-hatti-home-sections' ); ?></summary><p><label><?php esc_html_e( 'Accent hue (0–360)', 'creative-hatti-home-sections' ); ?><input type="number" min="0" max="360" name="<?php echo esc_attr( $prefix . '[hue]' ); ?>" value="<?php echo esc_attr( $row['hue'] ?? 150 ); ?>"></label> <label><?php esc_html_e( 'Illustration fallback', 'creative-hatti-home-sections' ); ?><select name="<?php echo esc_attr( $prefix . '[artwork]' ); ?>"><?php foreach ( self::artwork_variants() as $variant ) : ?><option value="<?php echo esc_attr( $variant ); ?>" <?php selected( $row['artwork'] ?? 'festival', $variant ); ?>><?php echo esc_html( ucwords( str_replace( '-', ' ', $variant ) ) ); ?></option><?php endforeach; ?></select></label></p></details>
				<p class="ch-home-image"><input type="hidden" class="ch-home-image-id" name="<?php echo esc_attr( $prefix . '[image_id]' ); ?>" value="<?php echo esc_attr( $row['image_id'] ?? 0 ); ?>"><img class="ch-home-image-preview" src="<?php echo esc_url( $image ? $image[0] : '' ); ?>" alt="" <?php echo $image ? '' : 'hidden'; ?>><button type="button" class="button ch-home-select-image"><?php esc_html_e( 'Choose thumbnail', 'creative-hatti-home-sections' ); ?></button><button type="button" class="button ch-home-remove-image" <?php echo $image ? '' : 'hidden'; ?>><?php esc_html_e( 'Remove image', 'creative-hatti-home-sections' ); ?></button></p>
			</div></div>
		</div>
		<?php
	}

	/**
	 * Render one configurable card section.
	 *
	 * @param string           $key Section option key.
	 * @param string           $title Section title.
	 * @param array            $settings Current options.
	 * @param WP_Term[]|WP_Error $terms Available categories.
	 */
	private static function render_section( $key, $title, $settings, $terms ) {
		$rows = isset( $settings[ $key ] ) && is_array( $settings[ $key ] ) ? $settings[ $key ] : array();
		if ( empty( $rows ) ) {
			$rows = array( array() );
		}
		$enabled = ! empty( $settings[ $key . '_enabled' ] );
		?>
		<section class="ch-home-panel" id="ch-panel-<?php echo esc_attr( $key ); ?>" role="tabpanel" aria-labelledby="ch-tab-<?php echo esc_attr( $key ); ?>" data-panel="<?php echo esc_attr( $key ); ?>" <?php echo 'characters' === $key ? '' : 'hidden'; ?>>
			<header class="ch-home-panel-head"><div><h2><?php echo esc_html( $title ); ?></h2><p><?php esc_html_e( 'Choose the categories and artwork shown in this homepage section.', 'creative-hatti-home-sections' ); ?></p></div><label class="ch-home-enable"><input type="checkbox" name="<?php echo esc_attr( self::OPTION . '[' . $key . '_enabled]' ); ?>" value="1" <?php checked( $enabled ); ?>> <?php esc_html_e( 'Enabled', 'creative-hatti-home-sections' ); ?></label></header>
			<div class="ch-home-rows" data-section="<?php echo esc_attr( $key ); ?>">
				<?php foreach ( array_values( $rows ) as $index => $row ) : ?>
					<?php self::render_row( $key, $index, $row, $terms ); ?>
				<?php endforeach; ?>
			</div>
			<?php if ( ! is_wp_error( $terms ) ) : ?>
				<button type="button" class="button ch-home-add-row" data-section="<?php echo esc_attr( $key ); ?>"><?php esc_html_e( 'Add category', 'creative-hatti-home-sections' ); ?></button>
			<?php endif; ?>
			<script type="text/html" id="<?php echo esc_attr( 'ch-home-row-template-' . $key ); ?>">
				<?php self::render_row( '__SECTION__', '__INDEX__', array(), $terms ); ?>
			</script>
		</section>
		<?php
	}

	/**
	 * Render one editable card row.
	 *
	 * @param string             $section Section key.
	 * @param int                $index Row index.
	 * @param array              $row Saved values.
	 * @param WP_Term[]|WP_Error $terms Available categories.
	 */
	private static function render_row( $section, $index, $row, $terms ) {
		$prefix = self::OPTION . '[' . $section . '][' . $index . ']';
		$term_id = isset( $row['category_id'] ) ? absint( $row['category_id'] ) : 0;
		$image_id = isset( $row['image_id'] ) ? absint( $row['image_id'] ) : 0;
		$image = $image_id ? wp_get_attachment_image_src( $image_id, 'thumbnail' ) : false;
		$artwork = isset( $row['artwork'] ) ? $row['artwork'] : 'festival';
		$term = $term_id ? get_term( $term_id, self::TAXONOMY ) : false;
		$display_title = ! empty( $row['title'] ) ? $row['title'] : ( $term && ! is_wp_error( $term ) ? $term->name : __( 'New category', 'creative-hatti-home-sections' ) );
		?>
		<div class="ch-home-row">
			<div class="ch-home-row-summary">
				<img class="ch-home-row-thumb" src="<?php echo esc_url( $image ? $image[0] : '' ); ?>" alt="" <?php echo $image ? '' : 'hidden'; ?>>
				<div class="ch-home-row-copy"><strong class="ch-home-row-title"><?php echo esc_html( $display_title ); ?></strong><span class="ch-home-row-subtitle"><?php echo esc_html( $term && ! is_wp_error( $term ) ? $term->name : ( $row['blurb'] ?? '' ) ); ?></span></div>
				<div class="ch-home-row-actions"><button type="button" class="button ch-home-edit-row"><?php esc_html_e( 'Edit', 'creative-hatti-home-sections' ); ?></button><button type="button" class="button-link ch-home-move-up" aria-label="Move up">↑</button><button type="button" class="button-link ch-home-move-down" aria-label="Move down">↓</button><button type="button" class="button-link-delete ch-home-remove-row"><?php esc_html_e( 'Remove', 'creative-hatti-home-sections' ); ?></button></div>
			</div>
			<div class="ch-home-row-editor" hidden>
			<div class="inside">
				<p>
					<label><?php esc_html_e( 'Category', 'creative-hatti-home-sections' ); ?><br>
						<select class="widefat" name="<?php echo esc_attr( $prefix . '[category_id]' ); ?>">
							<option value=""><?php esc_html_e( 'Choose a category', 'creative-hatti-home-sections' ); ?></option>
							<?php if ( ! is_wp_error( $terms ) ) : ?>
								<?php foreach ( $terms as $term ) : ?>
									<option value="<?php echo esc_attr( $term->term_id ); ?>" <?php selected( $term_id, $term->term_id ); ?>><?php echo esc_html( $term->name . ' (' . $term->slug . ')' ); ?></option>
								<?php endforeach; ?>
							<?php endif; ?>
						</select>
					</label>
				</p>
				<p>
					<label><?php esc_html_e( 'Card title (optional)', 'creative-hatti-home-sections' ); ?><br>
						<input class="widefat" type="text" name="<?php echo esc_attr( $prefix . '[title]' ); ?>" value="<?php echo esc_attr( isset( $row['title'] ) ? $row['title'] : '' ); ?>">
					</label>
				</p>
				<p>
					<label><?php esc_html_e( 'Description (optional)', 'creative-hatti-home-sections' ); ?><br>
						<textarea class="widefat" rows="2" name="<?php echo esc_attr( $prefix . '[blurb]' ); ?>"><?php echo esc_textarea( isset( $row['blurb'] ) ? $row['blurb'] : '' ); ?></textarea>
					</label>
				</p>
				<details class="ch-home-advanced"><summary><?php esc_html_e( 'Advanced appearance', 'creative-hatti-home-sections' ); ?></summary>
				<p>
					<label><?php esc_html_e( 'Accent hue (0–360)', 'creative-hatti-home-sections' ); ?>
						<input type="number" min="0" max="360" name="<?php echo esc_attr( $prefix . '[hue]' ); ?>" value="<?php echo esc_attr( isset( $row['hue'] ) ? $row['hue'] : 150 ); ?>">
					</label>
					<label><?php esc_html_e( 'Illustration fallback', 'creative-hatti-home-sections' ); ?>
						<select name="<?php echo esc_attr( $prefix . '[artwork]' ); ?>">
							<?php foreach ( self::artwork_variants() as $variant ) : ?>
								<option value="<?php echo esc_attr( $variant ); ?>" <?php selected( $artwork, $variant ); ?>><?php echo esc_html( ucwords( str_replace( '-', ' ', $variant ) ) ); ?></option>
							<?php endforeach; ?>
						</select>
					</label>
				</p>
				</details>
				<p class="ch-home-image">
					<input type="hidden" class="ch-home-image-id" name="<?php echo esc_attr( $prefix . '[image_id]' ); ?>" value="<?php echo esc_attr( $image_id ); ?>">
					<img class="ch-home-image-preview" src="<?php echo esc_url( $image ? $image[0] : '' ); ?>" alt="" <?php echo $image ? '' : 'hidden'; ?>>
					<button type="button" class="button ch-home-select-image"><?php esc_html_e( 'Choose thumbnail', 'creative-hatti-home-sections' ); ?></button>
					<button type="button" class="button ch-home-remove-image" <?php echo $image ? '' : 'hidden'; ?>><?php esc_html_e( 'Remove image', 'creative-hatti-home-sections' ); ?></button>
				</p>
			</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Fetch EDD categories without treating a missing taxonomy as an empty list.
	 *
	 * @return WP_Term[]|WP_Error
	 */
	private static function get_category_terms() {
		if ( ! taxonomy_exists( self::TAXONOMY ) ) {
			return new WP_Error( 'ch_home_sections_taxonomy_missing', 'EDD category taxonomy is unavailable.' );
		}

		$terms = get_terms(
			array(
				'taxonomy'   => self::TAXONOMY,
				'hide_empty' => false,
				'orderby'    => 'name',
				'order'      => 'ASC',
			)
		);

		return $terms;
	}

	/**
	 * Register the public, read-only homepage content route.
	 */
	public static function register_routes() {
		register_rest_route(
			self::NAMESPACE,
			'/homepage-sections',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_homepage_sections' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * Return only curated public category data and selected image metadata.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_homepage_sections() {
		if ( ! taxonomy_exists( self::TAXONOMY ) ) {
			return new WP_Error(
				'ch_home_sections_taxonomy_missing',
				'Product categories are unavailable.',
				array( 'status' => 503 )
			);
		}

		$settings = get_option( self::OPTION, array() );
		$settings = is_array( $settings ) ? $settings : array();
		$characters = ! empty( $settings['characters_enabled'] )
			? self::build_cards( isset( $settings['characters'] ) ? $settings['characters'] : array(), false )
			: array();
		$packs = ! empty( $settings['packs_enabled'] )
			? self::build_pack_cards( isset( $settings['packs'] ) ? $settings['packs'] : array(), $settings, ( new DateTimeImmutable( 'now', new DateTimeZone( 'Asia/Kolkata' ) ) )->format( 'Y-m-d' ) )
			: array();

		return new WP_REST_Response(
			array(
				'success' => true,
				'data'    => array_merge( CH_Home_Content::data( $settings ), array(
					'homepage_config_v2'           => self::public_config_v2( $settings['v2'] ?? array() ),
					'character_categories_enabled' => ! empty( $settings['characters_enabled'] ),
					'featured_packs_enabled'       => ! empty( $settings['packs_enabled'] ),
					'character_categories'         => $characters,
					'featured_packs'               => $packs,
				) ),
			),
			200
		);
	}

	/** Return only allow-listed public Hero overrides and public image DTOs. */
	private static function public_config_v2( $config ) {
		$config = is_array( $config ) ? $config : array();
		$hero = is_array( $config['hero'] ?? null ) ? $config['hero'] : array();
		$fields = array();
		foreach ( array( 'eyebrow', 'heading', 'description', 'search_placeholder', 'search_button_text' ) as $key ) {
			$field = is_array( $hero[ $key ] ?? null ) ? $hero[ $key ] : array();
			$custom = ( $field['mode'] ?? 'default' ) === 'custom';
			$fields[ $key ] = array( 'mode' => $custom ? 'custom' : 'default', 'value' => $custom ? sanitize_textarea_field( $field['value'] ?? '' ) : null );
		}
		$enabled = is_array( $hero['enabled'] ?? null ) ? $hero['enabled'] : array();
		$images = array();
		for ( $index = 0; $index < 4; $index++ ) {
			$image = is_array( $hero['images'][ $index ] ?? null ) ? $hero['images'][ $index ] : array();
			$custom = ( $image['mode'] ?? 'default' ) === 'custom';
			$image_id = absint( $image['attachment_id'] ?? 0 );
			$images[] = array(
				'mode' => $custom ? 'custom' : 'default',
				'image' => $custom && $image_id ? self::image_dto( $image_id ) : null,
				'link_url' => $custom ? self::sanitize_pack_url( $image['link_url'] ?? '' ) : '',
			);
		}
		$stats = array();
		for ( $index = 0; $index < 3; $index++ ) {
			$stat = is_array( $hero['stats'][ $index ] ?? null ) ? $hero['stats'][ $index ] : array();
			$custom = ( $stat['mode'] ?? 'default' ) === 'custom';
			$stats[] = array( 'mode' => $custom ? 'custom' : 'default', 'value' => $custom ? sanitize_text_field( $stat['value'] ?? '' ) : null, 'label' => $custom ? sanitize_text_field( $stat['label'] ?? '' ) : null, 'visible' => ! array_key_exists( 'visible', $stat ) || ! empty( $stat['visible'] ) );
		}
		return array(
			'version' => 2,
			'hero' => array_merge( $fields, array(
				'enabled' => array( 'mode' => ( $enabled['mode'] ?? 'default' ) === 'custom' ? 'custom' : 'default', 'value' => ( $enabled['mode'] ?? 'default' ) === 'custom' ? ! empty( $enabled['value'] ) : null ),
				'images' => $images,
				'stats' => $stats,
			) ),
		);
	}

	/**
	 * Build safe frontend card DTOs from saved category selections.
	 *
	 * @param array $rows Saved rows.
	 * @param bool  $is_pack Whether to build a featured-pack card.
	 * @return array
	 */
	private static function build_cards( $rows, $is_pack ) {
		$cards = array();
		foreach ( array_slice( (array) $rows, 0, self::MAX_ROWS ) as $index => $row ) {
			if ( ! is_array( $row ) || empty( $row['category_id'] ) ) {
				continue;
			}

			$term = get_term( absint( $row['category_id'] ), self::TAXONOMY );
			if ( ! $term || is_wp_error( $term ) ) {
				continue;
			}

			$title = ! empty( $row['title'] ) ? sanitize_text_field( $row['title'] ) : $term->name;
			$blurb = ! empty( $row['blurb'] ) ? sanitize_textarea_field( $row['blurb'] ) : wp_strip_all_tags( $term->description );
			$image = ! empty( $row['image_id'] ) ? self::image_dto( absint( $row['image_id'] ) ) : null;
			$artwork = isset( $row['artwork'] ) && in_array( $row['artwork'], self::artwork_variants(), true )
				? $row['artwork']
				: 'festival';

			if ( $is_pack ) {
				$cards[] = array(
					'id'           => 'wp-category-' . $term->term_id,
					'slug'         => $term->slug,
					'title'        => $title,
					'tagline'      => $blurb,
					'query'        => $term->slug,
					'hue'          => isset( $row['hue'] ) ? absint( $row['hue'] ) : 150,
					'kind'         => 'topical',
					'featured'     => true,
					'sort_order'   => (int) $index + 1,
					'category_slug'=> $term->slug,
					'image'        => $image,
					'artwork'      => $artwork,
				);
				continue;
			}

			$cards[] = array(
				'id'           => 'wp-category-' . $term->term_id,
				'name'         => $title,
				'blurb'        => $blurb,
				'query'        => $term->slug,
				'category_slug'=> $term->slug,
				'hue'          => isset( $row['hue'] ) ? absint( $row['hue'] ) : 150,
				'artwork'      => $artwork,
				'count'        => (int) $term->count,
				'image'        => $image,
			);
		}

		return $cards;
	}

	/** Determine whether a scheduled Handpicked Pack is visible on an India date. */
	public static function pack_is_active( $row, $today ) {
		if ( 'seasonal' !== ( $row['display_mode'] ?? 'evergreen' ) ) {
			return true;
		}
		$start = CH_Home_Content::date_value( $row['start_date'] ?? '' );
		$end = CH_Home_Content::date_value( $row['end_date'] ?? '' );
		$today = CH_Home_Content::date_value( $today );
		if ( ! $start || ! $end || ! $today ) {
			return false;
		}
		if ( ! empty( $row['annual'] ) ) {
			$start = substr( $start, 5 );
			$end = substr( $end, 5 );
			$today = substr( $today, 5 );
			return $start <= $end ? ( $today >= $start && $today <= $end ) : ( $today >= $start || $today <= $end );
		}
		return $start <= $today && $today <= $end;
	}

	/** Stable destination identity used to prevent duplicate cards. */
	private static function pack_destination_key( $row, $term ) {
		$url = self::sanitize_pack_url( $row['link_url'] ?? '' );
		if ( $url ) {
			$parts = parse_url( $url );
			if ( isset( $parts['host'] ) ) {
				$path = $parts['path'] ?? '/';
				$path = '/' === $path ? $path : rtrim( $path, '/' );
				return 'url:' . strtolower( $parts['scheme'] ?? 'https' ) . '://' . strtolower( $parts['host'] ) . ( isset( $parts['port'] ) ? ':' . $parts['port'] : '' ) . $path . ( isset( $parts['query'] ) ? '?' . $parts['query'] : '' );
			}
			$path = $parts['path'] ?? $url;
			$path = '/' === $path ? $path : rtrim( $path, '/' );
			return 'url:' . $path . ( isset( $parts['query'] ) ? '?' . $parts['query'] : '' );
		}
		if ( $term && ! is_wp_error( $term ) ) {
			return 'category:' . $term->slug;
		}
		$query = strtolower( trim( preg_replace( '/\s+/', ' ', sanitize_text_field( $row['query'] ?? '' ) ) ) );
		return $query ? 'search:' . $query : '';
	}

	/** Select validated pack rows in manual order or seasonal-priority order. */
	public static function select_pack_rows( $rows, $mode, $limit, $today ) {
		$mode = 'automatic' === $mode ? 'automatic' : 'manual';
		$limit = min( self::MAX_ROWS, max( 1, absint( $limit ) ) );
		$today = CH_Home_Content::date_value( $today );
		if ( ! $today ) {
			$today = ( new DateTimeImmutable( 'now', new DateTimeZone( 'Asia/Kolkata' ) ) )->format( 'Y-m-d' );
		}
		$eligible = array();
		foreach ( (array) $rows as $index => $row ) {
			if ( ! is_array( $row ) || ( array_key_exists( 'enabled', $row ) && empty( $row['enabled'] ) ) ) {
				continue;
			}
			$term_id = absint( $row['category_id'] ?? 0 );
			$term = $term_id ? get_term( $term_id, self::TAXONOMY ) : false;
			if ( $term && is_wp_error( $term ) ) {
				$term = false;
			}
			if ( $mode === 'automatic' && ! self::pack_is_active( $row, $today ) ) {
				continue;
			}
			if ( ! sanitize_text_field( $row['title'] ?? '' ) && ! $term ) {
				continue;
			}
			if ( ! $term && ! self::sanitize_pack_url( $row['link_url'] ?? '' ) && empty( $row['query'] ) ) {
				continue;
			}
			$key = self::pack_destination_key( $row, $term );
			if ( ! $key ) {
				continue;
			}
			$eligible[] = array( 'row' => $row, 'term' => $term, 'key' => $key, 'index' => (int) $index );
		}
		if ( 'automatic' === $mode ) {
			usort( $eligible, function ( $a, $b ) {
				$a_seasonal = 'seasonal' === ( $a['row']['display_mode'] ?? 'evergreen' );
				$b_seasonal = 'seasonal' === ( $b['row']['display_mode'] ?? 'evergreen' );
				return (int) $b_seasonal <=> (int) $a_seasonal
					?: (int) ( $b['row']['priority'] ?? 0 ) <=> (int) ( $a['row']['priority'] ?? 0 )
					?: $a['index'] <=> $b['index'];
			} );
		}
		$selected = array();
		$destinations = array();
		foreach ( $eligible as $entry ) {
			if ( isset( $destinations[ $entry['key'] ] ) ) {
				continue;
			}
			$destinations[ $entry['key'] ] = true;
			$entry['sort_order'] = count( $selected ) + 1;
			$selected[] = $entry;
			if ( count( $selected ) >= $limit ) {
				break;
			}
		}
		return $selected;
	}

	/** Build only the cards selected for this REST response. */
	private static function build_pack_cards( $rows, $settings, $today ) {
		$mode = $settings['packs_mode'] ?? 'manual';
		$limit = $settings['packs_max_visible'] ?? 5;
		$cards = array();
		foreach ( self::select_pack_rows( $rows, $mode, $limit, $today ) as $entry ) {
			$row = $entry['row'];
			$term = $entry['term'];
			$title = ! empty( $row['title'] ) ? sanitize_text_field( $row['title'] ) : ( $term ? $term->name : '' );
			$category_slug = $term ? $term->slug : '';
			$slug = $category_slug ?: sanitize_title( $title );
			$image = ! empty( $row['image_id'] ) ? self::image_dto( absint( $row['image_id'] ) ) : null;
			$description = ! empty( $row['blurb'] ) ? sanitize_textarea_field( $row['blurb'] ) : ( $term ? wp_strip_all_tags( $term->description ) : '' );
			$cards[] = array(
				'id'            => 'wp-pack-' . sanitize_title( $title ) . '-' . $entry['index'],
				'slug'          => $slug,
				'title'         => $title,
				'tagline'       => $description,
				'query'         => sanitize_text_field( $row['query'] ?? '' ) ?: ( $category_slug ?: $title ),
				'hue'           => isset( $row['hue'] ) ? absint( $row['hue'] ) : 150,
				'kind'          => 'seasonal' === ( $row['display_mode'] ?? 'evergreen' ) ? 'seasonal' : 'topical',
				'featured'      => true,
				'sort_order'    => $entry['sort_order'],
				'category_slug' => $category_slug,
				'url'           => self::sanitize_pack_url( $row['link_url'] ?? '' ),
				'image'         => $image,
				'artwork'       => in_array( $row['artwork'] ?? '', self::artwork_variants(), true ) ? $row['artwork'] : 'festival',
			);
		}
		return $cards;
	}

	/**
	 * Serialize a selected image without exposing attachment metadata.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return array|null
	 */
	public static function image_dto( $attachment_id ) {
		if ( 'attachment' !== get_post_type( $attachment_id ) || ! wp_attachment_is_image( $attachment_id ) ) {
			return null;
		}

		$source = wp_get_attachment_image_src( $attachment_id, 'large' );
		if ( ! $source ) {
			return null;
		}

		return array(
			'id'     => $attachment_id,
			'url'    => esc_url_raw( $source[0] ),
			'width'  => (int) $source[1],
			'height' => (int) $source[2],
			'alt'    => sanitize_text_field( get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ) ),
		);
	}
}

CH_Home_Sections::boot();
