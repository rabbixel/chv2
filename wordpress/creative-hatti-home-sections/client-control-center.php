<?php
/**
 * Client-facing WordPress landing page for Creative Hatti store operations.
 *
 * This deliberately links to existing WordPress and EDD screens. It does not
 * replace their data models or alter existing homepage/API settings.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class CH_Client_Control_Center {
	const PAGE = 'ch-control-center';

	public static function boot() {
		add_action( 'admin_menu', array( __CLASS__, 'register_menu' ), 5 );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
		add_action( 'admin_head', array( __CLASS__, 'print_menu_state_bootstrap' ), 1 );
		add_action( 'admin_footer', array( __CLASS__, 'render_menu_toggle' ), 99 );
	}

	public static function register_menu() {
		add_menu_page(
			__( 'Creative Hatti Control Center', 'creative-hatti-home-sections' ),
			__( 'Creative Hatti', 'creative-hatti-home-sections' ),
			'manage_options',
			self::PAGE,
			array( __CLASS__, 'render' ),
			'dashicons-store',
			3
		);
	}

	public static function enqueue_assets( $hook ) {
		$path = __DIR__ . '/control-center.css';
		wp_enqueue_style(
			'ch-control-center',
			plugin_dir_url( __FILE__ ) . 'control-center.css',
			array(),
			file_exists( $path ) ? (string) filemtime( $path ) : '1.0.0'
		);
	}

	/**
	 * Apply the saved menu preference before the admin sidebar is painted.
	 */
	public static function print_menu_state_bootstrap() {
		?>
		<script>
		(function () {
			try {
				var expanded = window.localStorage.getItem('chAdminMenuExpanded') === '1';
				document.documentElement.classList.add(expanded ? 'ch-admin-menu-expanded' : 'ch-admin-menu-collapsed');
			} catch (e) {
				document.documentElement.classList.add('ch-admin-menu-collapsed');
			}
		})();
		</script>
		<?php
	}

	/**
	 * Add a reversible expand/collapse control to the WordPress sidebar.
	 */
	public static function render_menu_toggle() {
		?>
		<script>
		(function () {
			var menu = document.getElementById('adminmenu');
			var creativeHatti = document.getElementById('toplevel_page_' + <?php echo wp_json_encode( self::PAGE ); ?>);
			if (!menu || !creativeHatti || document.getElementById('ch-admin-menu-toggle')) return;

			var item = document.createElement('li');
			item.id = 'ch-admin-menu-toggle';
			item.className = 'ch-admin-menu-toggle';
			var button = document.createElement('button');
			button.type = 'button';
			button.className = 'ch-admin-menu-toggle-button';
			button.setAttribute('aria-controls', 'adminmenu');
			item.appendChild(button);
			creativeHatti.insertAdjacentElement('afterend', item);

			function update(expanded) {
				document.documentElement.classList.toggle('ch-admin-menu-expanded', expanded);
				document.documentElement.classList.toggle('ch-admin-menu-collapsed', !expanded);
				button.textContent = expanded ? '− Hide advanced options' : '+ Show all WordPress options';
				button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
				try { window.localStorage.setItem('chAdminMenuExpanded', expanded ? '1' : '0'); } catch (e) {}
			}

			button.addEventListener('click', function () {
				update(!document.documentElement.classList.contains('ch-admin-menu-expanded'));
			});
			update(document.documentElement.classList.contains('ch-admin-menu-expanded'));
		})();
		</script>
		<?php
	}

	private static function menu_url( $needles ) {
		global $menu, $submenu;

		foreach ( (array) $menu as $item ) {
			$title = isset( $item[0] ) ? wp_strip_all_tags( (string) $item[0] ) : '';
			$href  = isset( $item[2] ) ? (string) $item[2] : '';
			foreach ( $needles as $needle ) {
				if ( $title && false !== stripos( $title, $needle ) && $href ) {
					return self::admin_href( $href );
				}
			}
		}

		foreach ( (array) $submenu as $items ) {
			foreach ( (array) $items as $item ) {
				$title = isset( $item[0] ) ? wp_strip_all_tags( (string) $item[0] ) : '';
				$href  = isset( $item[2] ) ? (string) $item[2] : '';
				foreach ( $needles as $needle ) {
					if ( $title && false !== stripos( $title, $needle ) && $href ) {
						return self::admin_href( $href );
					}
				}
			}
		}

		return '';
	}

	private static function admin_href( $href ) {
		if ( preg_match( '#^https?://#i', $href ) ) {
			return '';
		}
		return admin_url( ltrim( $href, '/' ) );
	}

	private static function card( $title, $description, $url, $icon, $action = '' ) {
		if ( ! $url ) {
			return;
		}
		?>
		<a class="ch-control-card" href="<?php echo esc_url( $url ); ?>">
			<span class="ch-control-card-icon dashicons <?php echo esc_attr( $icon ); ?>" aria-hidden="true"></span>
			<span class="ch-control-card-copy">
				<strong><?php echo esc_html( $title ); ?></strong>
				<span><?php echo esc_html( $description ); ?></span>
				<?php if ( $action ) : ?><em><?php echo esc_html( $action ); ?></em><?php endif; ?>
			</span>
			<span class="ch-control-card-arrow" aria-hidden="true">→</span>
		</a>
		<?php
	}

	public static function render() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access the Creative Hatti Control Center.', 'creative-hatti-home-sections' ) );
		}

		$homepage_url = menu_page_url( 'ch-home-sections', false );
		$orders_url   = self::menu_url( array( 'orders', 'payment history', 'payments' ) );
		$customers_url = self::menu_url( array( 'customers' ) );
		$settings_url = self::menu_url( array( 'settings' ) );
		?>
		<div class="wrap ch-control-center">
			<header class="ch-control-header">
				<div>
					<p class="ch-control-eyebrow"><?php esc_html_e( 'STORE MANAGEMENT', 'creative-hatti-home-sections' ); ?></p>
					<h1><?php esc_html_e( 'Creative Hatti Control Center', 'creative-hatti-home-sections' ); ?></h1>
					<p><?php esc_html_e( 'The everyday tools for keeping your marketplace up to date.', 'creative-hatti-home-sections' ); ?></p>
				</div>
				<a class="ch-control-store-link" href="https://www.creativehatti.com/" target="_blank" rel="noopener noreferrer">
					<span class="dashicons dashicons-external" aria-hidden="true"></span>
					<?php esc_html_e( 'View storefront', 'creative-hatti-home-sections' ); ?>
				</a>
			</header>

			<section class="ch-control-section" aria-labelledby="ch-control-content-title">
				<div class="ch-control-section-heading">
					<div>
						<h2 id="ch-control-content-title"><?php esc_html_e( 'Website content', 'creative-hatti-home-sections' ); ?></h2>
						<p><?php esc_html_e( 'Update what visitors see on the Creative Hatti storefront.', 'creative-hatti-home-sections' ); ?></p>
					</div>
				</div>
				<div class="ch-control-grid">
					<?php
					self::card( __( 'Homepage manager', 'creative-hatti-home-sections' ), __( 'Edit homepage sections, banners, discovery cards, collections and featured content.', 'creative-hatti-home-sections' ), $homepage_url, 'dashicons-layout', __( 'Open homepage editor', 'creative-hatti-home-sections' ) );
					if ( current_user_can( 'edit_pages' ) ) {
						self::card( __( 'Pages', 'creative-hatti-home-sections' ), __( 'Update essential website pages and policy content.', 'creative-hatti-home-sections' ), admin_url( 'edit.php?post_type=page' ), 'dashicons-admin-page' );
					}
					if ( current_user_can( 'edit_posts' ) ) {
						self::card( __( 'Blog posts', 'creative-hatti-home-sections' ), __( 'Publish and update articles and announcements.', 'creative-hatti-home-sections' ), admin_url( 'edit.php' ), 'dashicons-edit-page' );
					}
					if ( current_user_can( 'upload_files' ) ) {
						self::card( __( 'Media library', 'creative-hatti-home-sections' ), __( 'Upload and organize images used across the website.', 'creative-hatti-home-sections' ), admin_url( 'upload.php' ), 'dashicons-format-gallery' );
					}
					?>
				</div>
			</section>

			<section class="ch-control-section" aria-labelledby="ch-control-store-title">
				<div class="ch-control-section-heading">
					<div>
						<h2 id="ch-control-store-title"><?php esc_html_e( 'Store management', 'creative-hatti-home-sections' ); ?></h2>
						<p><?php esc_html_e( 'Manage the digital products and customer activity behind the marketplace.', 'creative-hatti-home-sections' ); ?></p>
					</div>
				</div>
				<div class="ch-control-grid">
					<?php
					if ( post_type_exists( 'download' ) && current_user_can( 'edit_posts' ) ) {
						self::card( __( 'Products', 'creative-hatti-home-sections' ), __( 'Edit digital products, prices, categories and downloadable files.', 'creative-hatti-home-sections' ), admin_url( 'edit.php?post_type=download' ), 'dashicons-products', __( 'Manage products', 'creative-hatti-home-sections' ) );
						self::card( __( 'Add a product', 'creative-hatti-home-sections' ), __( 'Create a new digital product for the marketplace.', 'creative-hatti-home-sections' ), admin_url( 'post-new.php?post_type=download' ), 'dashicons-plus-alt2' );
					}
					if ( $orders_url ) {
						self::card( __( 'Orders & payments', 'creative-hatti-home-sections' ), __( 'Review purchases and payment records in the existing EDD screen.', 'creative-hatti-home-sections' ), $orders_url, 'dashicons-clipboard' );
					}
					if ( $customers_url ) {
						self::card( __( 'Customers', 'creative-hatti-home-sections' ), __( 'Find customer records and review purchase history.', 'creative-hatti-home-sections' ), $customers_url, 'dashicons-groups' );
					}
					if ( taxonomy_exists( 'download_category' ) && current_user_can( 'manage_categories' ) ) {
						self::card( __( 'Product categories', 'creative-hatti-home-sections' ), __( 'Organize products into the categories used by the storefront.', 'creative-hatti-home-sections' ), admin_url( 'edit-tags.php?taxonomy=download_category&post_type=download' ), 'dashicons-category' );
					}
					?>
				</div>
				<?php if ( ! $orders_url && ! $customers_url ) : ?>
					<p class="ch-control-note"><?php esc_html_e( 'Order and customer shortcuts will appear when the active EDD administration screens are detected.', 'creative-hatti-home-sections' ); ?></p>
				<?php endif; ?>
			</section>

			<?php if ( current_user_can( 'manage_options' ) ) : ?>
				<section class="ch-control-advanced" aria-labelledby="ch-control-advanced-title">
					<div>
						<h2 id="ch-control-advanced-title"><?php esc_html_e( 'Administrator tools', 'creative-hatti-home-sections' ); ?></h2>
						<p><?php esc_html_e( 'Technical settings are kept separate from everyday content updates.', 'creative-hatti-home-sections' ); ?></p>
					</div>
					<?php if ( $settings_url ) : ?>
						<a href="<?php echo esc_url( $settings_url ); ?>"><?php esc_html_e( 'WordPress settings', 'creative-hatti-home-sections' ); ?> <span aria-hidden="true">→</span></a>
					<?php endif; ?>
					<a href="<?php echo esc_url( admin_url( 'plugins.php' ) ); ?>"><?php esc_html_e( 'Plugins', 'creative-hatti-home-sections' ); ?> <span aria-hidden="true">→</span></a>
					<a href="<?php echo esc_url( admin_url( 'users.php' ) ); ?>"><?php esc_html_e( 'Users', 'creative-hatti-home-sections' ); ?> <span aria-hidden="true">→</span></a>
				</section>
			<?php endif; ?>
			<footer class="ch-control-footer">
				<?php esc_html_e( 'Creative Hatti Control Center · Your storefront content stays connected to the existing WordPress and EDD data.', 'creative-hatti-home-sections' ); ?>
			</footer>
		</div>
		<?php
	}
}

CH_Client_Control_Center::boot();
