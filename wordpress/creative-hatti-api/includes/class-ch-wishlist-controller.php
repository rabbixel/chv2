<?php
/** Authenticated wishlist REST routes. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class CH_Wishlist_Controller {
	private $auth;
	private $wishlists;

	public function __construct( $auth, $wishlists = null ) {
		$this->auth = $auth;
		$this->wishlists = $wishlists instanceof CH_Wishlist_Service ? $wishlists : new CH_Wishlist_Service();
	}

	public function register_routes() {
		register_rest_route( CH_API::NAMESPACE, '/wishlist', array(
			array(
				'methods' => WP_REST_Server::READABLE,
				'callback' => array( $this, 'get_wishlist' ),
				'permission_callback' => array( $this->auth, 'session_permission' ),
			),
			array(
				'methods' => WP_REST_Server::CREATABLE,
				'callback' => array( $this, 'add_item' ),
				'permission_callback' => array( $this->auth, 'session_permission' ),
				'args' => $this->product_args(),
			),
			array(
				'methods' => WP_REST_Server::DELETABLE,
				'callback' => array( $this, 'remove_item' ),
				'permission_callback' => array( $this->auth, 'session_permission' ),
				'args' => $this->product_args(),
			),
		) );
	}

	private function product_args() {
		return array( 'productId' => array(
			'type' => 'integer',
			'required' => true,
			'sanitize_callback' => 'absint',
			'validate_callback' => static function ( $value ) { return absint( $value ) > 0; },
		) );
	}

	public function get_wishlist() {
		return $this->response( $this->wishlists->get_wishlist( get_current_user_id() ) );
	}

	public function add_item( $request ) {
		$product_id = absint( $request->get_param( 'productId' ) );
		if ( ! $this->is_public_download( $product_id ) ) {
			return CH_API::error( 'invalid_wishlist_product', 'Choose a published product to save.', 404 );
		}
		return $this->response( $this->wishlists->add_item( get_current_user_id(), $product_id ) );
	}

	public function remove_item( $request ) {
		$product_id = absint( $request->get_param( 'productId' ) );
		if ( ! $product_id ) {
			return CH_API::error( 'invalid_wishlist_item', 'The saved product is invalid.', 400 );
		}
		return $this->response( $this->wishlists->remove_item( get_current_user_id(), $product_id ) );
	}

	private function response( $result ) {
		if ( is_wp_error( $result ) ) {
			$data = $result->get_error_data();
			$status = is_array( $data ) && isset( $data['status'] ) ? absint( $data['status'] ) : 503;
			return CH_API::error( sanitize_key( $result->get_error_code() ), 'Wishlist request could not be completed.', $status );
		}
		$response = CH_API::success( $result );
		$response->header( 'Cache-Control', 'private, no-store, no-cache, max-age=0, must-revalidate' );
		$response->header( 'Pragma', 'no-cache' );
		return $response;
	}

	private function is_public_download( $product_id ) {
		$post = get_post( $product_id );
		return $post instanceof WP_Post && 'download' === $post->post_type && 'publish' === $post->post_status;
	}
}
