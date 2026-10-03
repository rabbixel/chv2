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
		wp_enqueue_style(
			'ch-home-sections-admin',
			plugin_dir_url( __FILE__ ) . 'admin.css',
			array(),
			'1.1.0'
		);
		wp_enqueue_script(
			'ch-home-sections-admin',
			plugin_dir_url( __FILE__ ) . 'admin.js',
			array( 'jquery' ),
			'1.1.0',
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
		$output = array(
			'characters_enabled' => ! empty( $input['characters_enabled'] ),
			'packs_enabled'      => ! empty( $input['packs_enabled'] ),
			'characters'         => self::sanitize_rows( isset( $input['characters'] ) ? $input['characters'] : array() ),
			'packs'               => self::sanitize_rows( isset( $input['packs'] ) ? $input['packs'] : array() ),
		);

		return array_merge( $output, CH_Home_Content::sanitize( $input ) );
	}

	/**
	 * Validate repeater rows against EDD categories and the media library.
	 *
	 * @param mixed $rows Submitted rows.
	 * @return array
	 */
	private static function sanitize_rows( $rows ) {
		if ( ! is_array( $rows ) ) {
			return array();
		}

		$clean = array();
		$invalid_category = false;
		$invalid_image = false;
		foreach ( array_slice( $rows, 0, self::MAX_ROWS ) as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}

			$term_id = isset( $row['category_id'] ) ? absint( $row['category_id'] ) : 0;
			if ( ! $term_id && empty( $row['title'] ) && empty( $row['blurb'] ) && empty( $row['image_id'] ) ) {
				continue;
			}

			$term = $term_id ? get_term( $term_id, self::TAXONOMY ) : null;
			if ( ! $term || is_wp_error( $term ) ) {
				$invalid_category = true;
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

			$clean[] = array(
				'category_id' => $term_id,
				'title'       => isset( $row['title'] ) ? sanitize_text_field( $row['title'] ) : '',
				'blurb'       => isset( $row['blurb'] ) ? sanitize_textarea_field( $row['blurb'] ) : '',
				'hue'         => isset( $row['hue'] ) ? min( 360, max( 0, absint( $row['hue'] ) ) ) : 150,
				'artwork'     => $artwork,
				'image_id'    => $image_id,
			);
		}

		if ( $invalid_category ) {
			add_settings_error(
				self::OPTION,
				'invalid_category',
				__( 'One or more cards were skipped because their selected EDD category is no longer available.', 'creative-hatti-home-sections' ),
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
		?>
		<div class="wrap ch-home-sections">
			<h1><?php esc_html_e( 'Creative Hatti Homepage Sections', 'creative-hatti-home-sections' ); ?></h1>
			<?php settings_errors( self::OPTION ); ?>
			<p><?php esc_html_e( 'Choose EDD categories for the homepage cards. Uploaded thumbnails appear in the artwork area while card text remains below or over a solid title panel.', 'creative-hatti-home-sections' ); ?></p>
			<?php if ( is_wp_error( $terms ) ) : ?>
				<div class="notice notice-error"><p><?php esc_html_e( 'EDD product categories are not available. Make sure Easy Digital Downloads is active.', 'creative-hatti-home-sections' ); ?></p></div>
			<?php endif; ?>
			<form method="post" action="options.php">
				<?php settings_fields( 'ch_home_sections_group' ); ?>
				<?php self::render_section( 'characters', __( 'Featured Character Categories', 'creative-hatti-home-sections' ), $settings, $terms ); ?>
				<?php self::render_section( 'packs', __( 'Featured Graphics & Illustration Packs', 'creative-hatti-home-sections' ), $settings, $terms ); ?>
				<?php CH_Home_Content::render( $settings, $terms ); ?>
				<?php submit_button( __( 'Save Homepage Sections', 'creative-hatti-home-sections' ) ); ?>
			</form>
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
		<div class="card">
			<h2><?php echo esc_html( $title ); ?></h2>
			<label>
				<input type="checkbox" name="<?php echo esc_attr( self::OPTION . '[' . $key . '_enabled]' ); ?>" value="1" <?php checked( $enabled ); ?>>
				<?php esc_html_e( 'Use these choices on the storefront', 'creative-hatti-home-sections' ); ?>
			</label>
			<p class="description"><?php esc_html_e( 'When unchecked, the storefront uses its built-in section. Add up to 8 cards; an empty saved list hides this section.', 'creative-hatti-home-sections' ); ?></p>
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
		</div>
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
		?>
		<div class="postbox ch-home-row">
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
				<p class="ch-home-image">
					<input type="hidden" class="ch-home-image-id" name="<?php echo esc_attr( $prefix . '[image_id]' ); ?>" value="<?php echo esc_attr( $image_id ); ?>">
					<img class="ch-home-image-preview" src="<?php echo esc_url( $image ? $image[0] : '' ); ?>" alt="" <?php echo $image ? '' : 'hidden'; ?>>
					<button type="button" class="button ch-home-select-image"><?php esc_html_e( 'Choose thumbnail', 'creative-hatti-home-sections' ); ?></button>
					<button type="button" class="button ch-home-remove-image" <?php echo $image ? '' : 'hidden'; ?>><?php esc_html_e( 'Remove image', 'creative-hatti-home-sections' ); ?></button>
				</p>
				<button type="button" class="button-link ch-home-move-up"><?php esc_html_e( 'Move up', 'creative-hatti-home-sections' ); ?></button>
				<button type="button" class="button-link ch-home-move-down"><?php esc_html_e( 'Move down', 'creative-hatti-home-sections' ); ?></button>
				<button type="button" class="button-link-delete ch-home-remove-row"><?php esc_html_e( 'Remove this card', 'creative-hatti-home-sections' ); ?></button>
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
			? self::build_cards( isset( $settings['packs'] ) ? $settings['packs'] : array(), true )
			: array();

		return new WP_REST_Response(
			array(
				'success' => true,
				'data'    => array_merge( CH_Home_Content::data( $settings ), array(
					'character_categories_enabled' => ! empty( $settings['characters_enabled'] ),
					'featured_packs_enabled'       => ! empty( $settings['packs_enabled'] ),
					'character_categories'         => $characters,
					'featured_packs'               => $packs,
				) ),
			),
			200
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
