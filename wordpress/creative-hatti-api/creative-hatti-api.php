<?php
/**
 * Plugin Name: Creative Hatti API
 * Description: Clean catalogue REST API for the Creative Hatti Next.js frontend.
 * Version: 0.1.0
 * Author: Rajesh Kamboj
 * Text Domain: creative-hatti-api
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CH_API_VERSION', '0.1.0' );
define( 'CH_API_FILE', __FILE__ );
define( 'CH_API_DIR', plugin_dir_path( __FILE__ ) );

require_once CH_API_DIR . 'includes/class-ch-cache.php';
require_once CH_API_DIR . 'includes/class-ch-purchase-limit-service.php';
require_once CH_API_DIR . 'includes/class-ch-media.php';
require_once CH_API_DIR . 'includes/class-ch-product-transformer.php';
require_once CH_API_DIR . 'includes/class-ch-products-controller.php';
require_once CH_API_DIR . 'includes/class-ch-wishlist-service.php';
require_once CH_API_DIR . 'includes/class-ch-wishlist-controller.php';
require_once CH_API_DIR . 'includes/class-ch-categories-controller.php';
require_once CH_API_DIR . 'includes/class-ch-auth-controller.php';
require_once CH_API_DIR . 'includes/class-ch-claim-controller.php';
require_once CH_API_DIR . 'includes/class-ch-orders-controller.php';
require_once CH_API_DIR . 'includes/class-ch-communications.php';
require_once CH_API_DIR . 'includes/class-ch-downloads-controller.php';
require_once CH_API_DIR . 'includes/class-ch-customer-controller.php';
require_once CH_API_DIR . 'includes/class-ch-cart-controller.php';
require_once CH_API_DIR . 'includes/class-ch-checkout-controller.php';
require_once CH_API_DIR . 'includes/class-ch-payment-controller.php';
require_once CH_API_DIR . 'includes/class-ch-api.php';

add_action(
	'plugins_loaded',
	static function () {
		( new CH_Communications() )->register_hooks();
		$limits = new CH_Purchase_Limit_Service();
		$limits->register_hooks();
		CH_API::instance();
	}
);

add_filter('plugin_row_meta', function ($links, $plugin_file) {
    // Replace 'creative-hatti-api/creative-hatti-api.php' with your actual plugin path if different
    if (plugin_basename(__FILE__) === $plugin_file) {
        $links[] = '<a href="https://pixldot.com/" target="_blank">PixlDot</a>';
    }
    return $links;
}, 10, 2);
