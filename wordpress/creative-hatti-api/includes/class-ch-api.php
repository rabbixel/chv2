<?php
/**
 * REST API bootstrap.
 *
 * @package CreativeHattiAPI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Main API coordinator.
 */
final class CH_API {
	public const NAMESPACE = 'ch/v1';

	/**
	 * Singleton instance.
	 *
	 * @var CH_API|null
	 */
	private static $instance = null;

	/**
	 * Products controller.
	 *
	 * @var CH_Products_Controller
	 */
	private $products_controller;

	/**
	 * Categories controller.
	 *
	 * @var CH_Categories_Controller
	 */
	private $categories_controller;

	/** EDD tag archives controller. */
	private $tags_controller;

	/**
	 * Authentication controller.
	 *
	 * @var CH_Auth_Controller
	 */
	private $auth_controller;

	/**
	 * Guest customer claim controller.
	 *
	 * @var CH_Claim_Controller
	 */
	private $claim_controller;

	/**
	 * Authenticated EDD order history controller.
	 *
	 * @var CH_Orders_Controller
	 */
	private $orders_controller;

	/**
	 * Authenticated, read-only download library controller.
	 *
	 * @var CH_Downloads_Controller
	 */
	private $downloads_controller;

	/** Authenticated customer license and profile endpoints. */
	private $customer_controller;
	private $cart_controller;
	private $checkout_controller;
	private $payment_controller;
	private $wishlist_controller;

	/**
	 * Get singleton.
	 *
	 * @return CH_API
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	private function __construct() {
		$media                     = new CH_Media();
		$transformer               = new CH_Product_Transformer( $media );
		$this->products_controller = new CH_Products_Controller( $transformer );
		$this->categories_controller = new CH_Categories_Controller( $this->products_controller );
		$this->tags_controller = new CH_Tags_Controller( $this->products_controller );
		$this->auth_controller = new CH_Auth_Controller();
		$this->claim_controller = new CH_Claim_Controller( $this->auth_controller );
		$this->orders_controller = new CH_Orders_Controller( $this->auth_controller );
		$this->customer_controller = new CH_Customer_Controller( $this->auth_controller );
		$this->cart_controller = new CH_Cart_Controller( $this->auth_controller );
		$this->checkout_controller = new CH_Checkout_Controller( $this->auth_controller, $this->cart_controller );
		$this->payment_controller = new CH_Payment_Controller( $this->auth_controller );
		$this->downloads_controller = new CH_Downloads_Controller( $this->auth_controller, $this->payment_controller );
		$this->wishlist_controller = new CH_Wishlist_Controller( $this->auth_controller );

		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
		// WordPress core reflects any Origin with credentials. Run after its
		// default CORS callback and replace that policy only for our namespace.
		add_filter( 'rest_pre_serve_request', array( $this, 'maybe_send_cors_headers' ), 99, 4 );
		add_filter( 'rest_post_dispatch', array( $this, 'envelope_errors' ), 10, 3 );
		add_action( 'template_redirect', array( $this, 'redirect_legacy_frontend' ), 0 );
	}


	/**
	 * Redirect public WordPress storefront pages to the Next.js canonical site.
	 *
	 * Keep REST, admin, media, and signed EDD file delivery on the API host.
	 * The hostname guard also leaves local WordPress development untouched.
	 */
	public function redirect_legacy_frontend() {
		if (
			is_admin() ||
			( defined( 'REST_REQUEST' ) && REST_REQUEST ) ||
			( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() ) ||
			( function_exists( 'wp_doing_cron' ) && wp_doing_cron() ) ||
			( function_exists( 'is_preview' ) && is_preview() )
		) {
			return;
		}

		$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( (string) $_SERVER['REQUEST_METHOD'] ) : 'GET';
		if ( ! in_array( $method, array( 'GET', 'HEAD' ), true ) ) {
			return;
		}

		$host = isset( $_SERVER['HTTP_HOST'] ) ? strtolower( preg_replace( '/:\d+$/', '', (string) $_SERVER['HTTP_HOST'] ) ) : '';
		if ( 'api.creativehatti.com' !== $host ) {
			return;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '/';
		$path        = wp_parse_url( $request_uri, PHP_URL_PATH );
		$path        = is_string( $path ) && '' !== $path ? '/' . ltrim( $path, '/' ) : '/';

		// These paths provide WordPress administration, APIs, and static backend media.
		$preserved_prefixes = array(
			'/wp-json',
			'/wp-admin',
			'/wp-content',
			'/wp-includes',
			'/wp-login.php',
			'/wp-cron.php',
			'/xmlrpc.php',
			'/wp-comments-post.php',
			'/edd-api',
		);
		foreach ( $preserved_prefixes as $prefix ) {
			if ( $path === $prefix || 0 === strpos( $path, $prefix . '/' ) ) {
				return;
			}
		}

		// Preserve native EDD signed-download requests issued after entitlement checks.
		foreach ( array( 'eddfile', 'token', 'download', 'download_id', 'payment_key' ) as $download_parameter ) {
			if ( isset( $_GET[ $download_parameter ] ) ) {
				return;
			}
		}
		$edd_action = isset( $_GET['edd_action'] ) ? sanitize_key( wp_unslash( $_GET['edd_action'] ) ) : '';
		if ( 'download_file' === $edd_action ) {
			return;
		}

		$target_path = $path;
		if ( preg_match( '#^/(?:product|downloads|download)/([^/]+)/?$#i', $path, $matches ) ) {
			$target_path = '/product/' . rawurlencode( rawurldecode( $matches[1] ) );
		} elseif ( preg_match( '#^/(?:download_category|download-category)/([^/]+)/?$#i', $path, $matches ) ) {
			$target_path = '/category/' . rawurlencode( rawurldecode( $matches[1] ) );
		} elseif ( preg_match( '#^/(?:download_tag|download-tag)/([^/]+)/?$#i', $path, $matches ) ) {
			$target_path = '/tag/' . rawurlencode( rawurldecode( $matches[1] ) );
		} elseif ( '/sitemap_index.xml' === strtolower( $path ) ) {
			$target_path = '/sitemap.xml';
		}

		$query = isset( $_SERVER['QUERY_STRING'] ) ? (string) wp_unslash( $_SERVER['QUERY_STRING'] ) : '';
		if ( '/' === $path && isset( $_GET['s'] ) ) {
			$search     = sanitize_text_field( wp_unslash( $_GET['s'] ) );
			$target_path = '/search';
			$query       = 'q=' . rawurlencode( $search );
		}

		$target_url = 'https://www.creativehatti.com' . $target_path;
		if ( '' !== $query ) {
			$target_url .= '?' . $query;
		}

		wp_redirect( $target_url, 308, 'Creative Hatti API storefront redirect' );
		exit;
	}

	/**
	 * Register all routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		// Public license descriptions used by Next.js product pages. Prices and
		// purchasability remain authoritative in Easy Digital Downloads.
		register_rest_route(
			self::NAMESPACE,
			'/licenses',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'public_licenses' ),
				'permission_callback' => array( __CLASS__, 'public_read_permission' ),
			)
		);
		$this->products_controller->register_routes();
		$this->categories_controller->register_routes();
		$this->tags_controller->register_routes();
		$this->auth_controller->register_routes();
		$this->claim_controller->register_routes();
		$this->orders_controller->register_routes();
		$this->downloads_controller->register_routes();
		$this->customer_controller->register_routes();
		$this->cart_controller->register_routes();
		$this->checkout_controller->register_routes();
		$this->payment_controller->register_routes();
		$this->wishlist_controller->register_routes();
	}

	/** Public license descriptions; never authorizes or calculates checkout prices. */
	public function public_licenses() {
		$items = array(
			array( 'id' => 'lic-personal', 'code' => 'personal', 'name' => 'Personal', 'description' => 'Personal, non-commercial use.', 'priceMultiplier' => 1, 'allowedUses' => array(), 'seats' => 1 ),
			array( 'id' => 'lic-commercial', 'code' => 'commercial', 'name' => 'Commercial', 'description' => 'Commercial usage rights are governed by the purchased EDD price option and product terms.', 'priceMultiplier' => 1, 'allowedUses' => array(), 'seats' => 1 ),
			array( 'id' => 'lic-extended', 'code' => 'extended', 'name' => 'Extended', 'description' => 'Extended usage rights are governed by the purchased EDD price option and product terms.', 'priceMultiplier' => 1, 'allowedUses' => array(), 'seats' => 1 ),
		);
		return new WP_REST_Response( $items, 200 );
	}

	/**
	 * Public read permission callback.
	 *
	 * @return bool
	 */
	public static function public_read_permission() {
		return true;
	}

	/**
	 * Wrap successful single-resource responses.
	 *
	 * @param mixed $data Response data.
	 * @param int   $status HTTP status.
	 * @return WP_REST_Response
	 */
	public static function success( $data, $status = 200 ) {
		return new WP_REST_Response(
			array(
				'success' => true,
				'data'    => $data,
			),
			$status
		);
	}

	/**
	 * Wrap successful collection responses.
	 *
	 * @param array $data Response data.
	 * @param array $pagination Pagination metadata.
	 * @param int   $status HTTP status.
	 * @return WP_REST_Response
	 */
	public static function collection( array $data, array $pagination, $status = 200 ) {
		return new WP_REST_Response(
			array(
				'success'    => true,
				'data'       => $data,
				'pagination' => $pagination,
			),
			$status
		);
	}

	/**
	 * Build a safe API error.
	 *
	 * @param string $code Error code.
	 * @param string $message Error message.
	 * @param int    $status HTTP status.
	 * @return WP_REST_Response
	 */
	public static function error( $code, $message, $status ) {
		return new WP_REST_Response(
			array(
				'success' => false,
				'error'  => array(
					'code'    => $code,
					'message' => $message,
				),
			),
			$status
		);
	}

	/**
	 * Restrict CORS headers to explicitly configured frontend origins.
	 *
	 * Set CH_API_ALLOWED_ORIGINS to a comma-separated list of exact origins,
	 * or use the ch_api_allowed_origins filter. When unset on a local .test or
	 * loopback WordPress host, only the local Next.js dev origin is enabled.
	 *
	 * @param bool            $served Whether served.
	 * @param WP_HTTP_Response $result Result.
	 * @param WP_REST_Request $request Request.
	 * @param WP_REST_Server  $server Server.
	 * @return bool
	 */
	public function maybe_send_cors_headers( $served, $result, $request, $server ) {
		if ( 0 !== strpos( $request->get_route(), '/' . self::NAMESPACE . '/' ) ) {
			return $served;
		}

		// Remove the credentialed origin reflected by WordPress core. Keep its
		// methods/headers for a trusted origin; without ACAO browsers cannot use
		// a preflight from an untrusted origin.
		header_remove( 'Access-Control-Allow-Origin' );
		header_remove( 'Access-Control-Allow-Credentials' );

		$origin = isset( $_SERVER['HTTP_ORIGIN'] )
			? self::normalize_cors_origin( esc_url_raw( wp_unslash( $_SERVER['HTTP_ORIGIN'] ) ) )
			: '';
		if ( '' !== $origin && $origin === self::allowed_cors_origin( $origin ) ) {
			header( 'Access-Control-Allow-Origin: ' . $origin );
			header( 'Access-Control-Allow-Credentials: true' );
			header( 'Vary: Origin', false );
		} else {
			// A denied origin should not receive a usable preflight policy either.
			header_remove( 'Access-Control-Allow-Methods' );
			header_remove( 'Access-Control-Allow-Headers' );
			header_remove( 'Access-Control-Expose-Headers' );
		}

		return $served;
	}

	/** Return only valid, normalized origin URLs; never accept paths or null origins. */
	private static function normalize_cors_origin( $origin ) {
		if ( ! is_string( $origin ) || '' === trim( $origin ) || 'null' === strtolower( trim( $origin ) ) ) {
			return '';
		}

		$parts = wp_parse_url( trim( $origin ) );
		if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
			return '';
		}
		if ( ! in_array( strtolower( $parts['scheme'] ), array( 'http', 'https' ), true ) ) {
			return '';
		}
		if ( isset( $parts['user'] ) || isset( $parts['pass'] ) || isset( $parts['query'] ) || isset( $parts['fragment'] ) ) {
			return '';
		}
		if ( isset( $parts['path'] ) && ! in_array( $parts['path'], array( '', '/' ), true ) ) {
			return '';
		}
		if ( isset( $parts['port'] ) && ( $parts['port'] < 1 || $parts['port'] > 65535 ) ) {
			return '';
		}

		$normalized = strtolower( $parts['scheme'] ) . '://' . strtolower( $parts['host'] );
		if ( isset( $parts['port'] ) ) {
			$normalized .= ':' . (int) $parts['port'];
		}
		return $normalized;
	}

	/** Resolve the exact origin allowlist from the process environment and WP filter. */
	private static function allowed_cors_origin( $origin ) {
		$origin = self::normalize_cors_origin( $origin );
		if ( '' === $origin ) {
			return '';
		}

		$environment_origins = getenv( 'CH_API_ALLOWED_ORIGINS' );
		if ( false !== $environment_origins ) {
			$allowed = '' === trim( $environment_origins )
				? array()
				: array_map( 'trim', explode( ',', $environment_origins ) );
		} else {
			$allowed = array();
			$site_host = strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) );
			if ( preg_match( '/(?:^|\\.)test$/', $site_host ) || in_array( $site_host, array( 'localhost', '127.0.0.1', '::1', '[::1]' ), true ) ) {
				$allowed[] = 'http://localhost:3000';
			}
		}

		$allowed = apply_filters( 'ch_api_allowed_origins', $allowed );
		$normalized = array_filter( array_map( array( __CLASS__, 'normalize_cors_origin' ), (array) $allowed ) );
		return in_array( $origin, $normalized, true ) ? $origin : '';
	}

	/**
	 * Normalize WordPress-generated REST validation errors for this namespace.
	 *
	 * @param WP_HTTP_Response $response Response.
	 * @param WP_REST_Server   $server Server.
	 * @param WP_REST_Request  $request Request.
	 * @return WP_HTTP_Response
	 */
	public function envelope_errors( $response, $server, $request ) {
		if ( 0 !== strpos( $request->get_route(), '/' . self::NAMESPACE . '/' ) ) {
			return $response;
		}

		if ( $response->get_status() < 400 ) {
			return $response;
		}

		$data = $response->get_data();
		if ( isset( $data['success'] ) ) {
			return $response;
		}

		$response->set_data(
			array(
				'success' => false,
				'error'   => array(
					'code'    => isset( $data['code'] ) ? sanitize_key( $data['code'] ) : 'rest_error',
					'message' => isset( $data['message'] ) ? sanitize_text_field( $data['message'] ) : 'Request failed.',
				),
			)
		);

		return $response;
	}
}
