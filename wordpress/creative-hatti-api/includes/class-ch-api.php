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
		$this->auth_controller = new CH_Auth_Controller();
		$this->claim_controller = new CH_Claim_Controller( $this->auth_controller );
		$this->orders_controller = new CH_Orders_Controller( $this->auth_controller );
		$this->downloads_controller = new CH_Downloads_Controller( $this->auth_controller );
		$this->customer_controller = new CH_Customer_Controller( $this->auth_controller );
		$this->cart_controller = new CH_Cart_Controller( $this->auth_controller );
		$this->checkout_controller = new CH_Checkout_Controller( $this->auth_controller, $this->cart_controller );
		$this->payment_controller = new CH_Payment_Controller( $this->auth_controller );

		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
		add_filter( 'rest_pre_serve_request', array( $this, 'maybe_send_cors_headers' ), 10, 4 );
		add_filter( 'rest_post_dispatch', array( $this, 'envelope_errors' ), 10, 3 );
	}

	/**
	 * Register all routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		$this->products_controller->register_routes();
		$this->categories_controller->register_routes();
		$this->auth_controller->register_routes();
		$this->claim_controller->register_routes();
		$this->orders_controller->register_routes();
		$this->downloads_controller->register_routes();
		$this->customer_controller->register_routes();
		$this->cart_controller->register_routes();
		$this->checkout_controller->register_routes();
		$this->payment_controller->register_routes();
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
	 * Restrict optional CORS headers to configured frontend origins.
	 *
	 * Configure with:
	 * add_filter( 'ch_api_allowed_origins', fn() => array( 'http://localhost:3000' ) );
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

		$origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_ORIGIN'] ) ) : '';
		if ( '' === $origin ) {
			return $served;
		}

		$allowed = apply_filters( 'ch_api_allowed_origins', array() );
		if ( in_array( $origin, array_map( 'esc_url_raw', (array) $allowed ), true ) ) {
			header( 'Access-Control-Allow-Origin: ' . $origin );
			header( 'Vary: Origin', false );
		}

		return $served;
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
