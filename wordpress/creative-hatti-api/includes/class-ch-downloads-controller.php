<?php
/**
 * Authenticated, read-only download library endpoints.
 *
 * @package CreativeHattiAPI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class CH_Downloads_Controller {
	private $auth_controller;
	private $payment_controller;

	public function __construct( CH_Auth_Controller $auth_controller, ?CH_Payment_Controller $payment_controller = null ) {
		$this->auth_controller = $auth_controller;
		$this->payment_controller = $payment_controller;
	}

	public function register_routes() {
		register_rest_route(
			CH_API::NAMESPACE,
			'/customer/downloads',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'list_downloads' ),
				'permission_callback' => array( $this->auth_controller, 'session_permission' ),
				'args'                => array(
					'page'     => array( 'default' => 1, 'validate_callback' => array( $this, 'validate_positive_integer' ) ),
					'per_page' => array( 'default' => 20, 'validate_callback' => array( $this, 'validate_page_size' ) ),
				),
			)
		);
		register_rest_route(
			CH_API::NAMESPACE,
			'/customer/downloads/file',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'request_file_url' ),
				'permission_callback' => array( $this->auth_controller, 'session_permission' ),
			)
		);
	}

	/** Mint a fresh native EDD URL only for a deliverable item owned by this authenticated EDD customer. */
	public function request_file_url( $request ) {
		if ( ! function_exists( 'edd_get_order_item' ) || ! function_exists( 'edd_get_order' ) || ! function_exists( 'edd_get_download_file_url' ) ) {
			return CH_API::error( 'edd_unavailable', 'Download delivery is temporarily unavailable.', 503 );
		}
		$customer = $this->current_customer();
		if ( is_wp_error( $customer ) ) { return CH_API::error( 'edd_unavailable', 'Download delivery is temporarily unavailable.', 503 ); }
		$item_id = absint( $request->get_param( 'order_item_id' ) );
		$file_key = $request->get_param( 'file_key' );
		if ( ! $customer || ! $item_id || ! is_string( $file_key ) || ! preg_match( '/^[A-Za-z0-9_-]{1,80}$/D', $file_key ) ) {
			return CH_API::error( 'download_unavailable', 'This file is not available for this account.', 404 );
		}
		$item = edd_get_order_item( $item_id );
		if ( ! $item || ! in_array( (string) ( $item->status ?? '' ), $this->deliverable_item_statuses(), true ) ) {
			return CH_API::error( 'download_unavailable', 'This file is not available for this account.', 404 );
		}
		$order = edd_get_order( (int) $item->order_id );
		if ( ! $this->is_customer_order_eligible( $order, $customer ) ) {
			return CH_API::error( 'download_unavailable', 'This file is not available for this account.', 404 );
		}
		$files = $this->entitled_files( (int) $item->product_id, $item->price_id ?? null );
		if ( ! array_key_exists( $file_key, $files ) || ! is_array( $files[ $file_key ] ) || empty( $files[ $file_key ]['file'] ) ) {
			return CH_API::error( 'download_unavailable', 'This file is not available for this account.', 404 );
		}
		$url = edd_get_download_file_url( $item, (string) $order->email, $file_key );
		if ( ! is_string( $url ) || '' === $url ) {
			return CH_API::error( 'download_unavailable', 'This file is temporarily unavailable. Please try again.', 503 );
		}
		return CH_API::success( array( 'url' => esc_url_raw( $url ) ) );
	}

	public function validate_positive_integer( $value ) {
		return is_scalar( $value ) && preg_match( '/^[1-9][0-9]{0,4}$/D', (string) $value );
	}

	public function validate_page_size( $value ) {
		return is_scalar( $value ) && preg_match( '/^[1-9][0-9]{0,2}$/D', (string) $value ) && (int) $value <= 50;
	}

	public function list_downloads( $request ) {
		$customer = $this->current_customer();
		if ( is_wp_error( $customer ) ) {
			return CH_API::error( 'edd_unavailable', 'Download library is temporarily unavailable.', 503 );
		}

		$page      = absint( $request->get_param( 'page' ) );
		$page      = $page ? $page : 1;
		$page_size = absint( $request->get_param( 'per_page' ) );
		$page_size = $page_size ? min( 50, $page_size ) : 20;
		if ( ! $customer ) {
			return CH_API::collection( array(), $this->pagination( $page, $page_size, 0 ) );
		}

		$args = array(
			'customer_id' => (int) $customer->id,
			'type'        => 'sale',
			'status__in'  => array( 'complete', 'partially_refunded' ),
		);
		$total  = edd_count_orders( $args );
		$orders = edd_get_orders(
			array_merge(
				$args,
				array(
					'number'        => $page_size,
					'offset'        => ( $page - 1 ) * $page_size,
					'orderby'       => array( 'date_created' => 'DESC', 'id' => 'DESC' ),
					'order'         => 'DESC',
					'no_found_rows' => true,
				)
			)
		);
		$orders = array_values( array_filter( (array) $orders, function ( $order ) use ( $customer ) {
			return $order instanceof EDD\Orders\Order && $this->is_customer_order_eligible( $order, $customer );
		} ) );

		return CH_API::collection(
			$this->transform_orders( $orders ),
			$this->pagination( $page, $page_size, (int) $total )
		);
	}

	private function current_customer() {
		if ( ! function_exists( 'edd_get_customer_by' ) || ! function_exists( 'edd_get_orders' ) || ! function_exists( 'edd_count_orders' ) || ! function_exists( 'edd_get_order_items' ) ) {
			return new WP_Error( 'edd_unavailable', 'EDD download library APIs unavailable.' );
		}

		$user_id  = get_current_user_id();
		$customer = $user_id ? edd_get_customer_by( 'user_id', $user_id ) : false;
		if ( ! $customer || (int) $customer->user_id !== (int) $user_id || empty( $customer->id ) ) {
			return false;
		}

		return $customer;
	}

	private function pagination( $page, $page_size, $total ) {
		$total_pages = (int) ceil( $total / $page_size );
		return array(
			'page'           => (int) $page,
			'page_size'      => (int) $page_size,
			'total_items'    => (int) $total,
			'total_pages'    => $total_pages,
			'has_next_page'  => $page * $page_size < $total,
			'has_prev_page'  => $page > 1 && $total > 0,
		);
	}

	private function transform_orders( $orders ) {
		if ( empty( $orders ) ) {
			return array();
		}

		$order_ids = array_map( static function ( $order ) { return (int) $order->id; }, $orders );
		$item_statuses = function_exists( 'edd_get_deliverable_order_item_statuses' )
			? edd_get_deliverable_order_item_statuses()
			: array( 'complete', 'partially_refunded' );
		$items = edd_get_order_items(
			array(
				'order_id__in' => $order_ids,
				'status__in'   => $item_statuses,
				'number'       => 5000,
				'orderby'      => array( 'order_id' => 'ASC', 'cart_index' => 'ASC', 'id' => 'ASC' ),
				'order'        => 'ASC',
				'no_found_rows'=> true,
			)
		);
		$items_by_order = array();
		$product_ids    = array();
		foreach ( (array) $items as $item ) {
			$items_by_order[ (int) $item->order_id ][] = $item;
			$product_ids[] = (int) $item->product_id;
		}

		$products = array();
		$thumbnail_ids = array();
		if ( $product_ids ) {
			$found_products = get_posts(
				array(
					'post_type'              => 'download',
					'post_status'            => 'publish',
					'post__in'               => array_values( array_unique( $product_ids ) ),
					'posts_per_page'         => count( array_unique( $product_ids ) ),
					'orderby'                => 'post__in',
					'update_post_meta_cache' => true,
					'update_post_term_cache' => false,
				)
			);
			foreach ( $found_products as $product ) {
				$products[ (int) $product->ID ] = $product;
				$thumbnail_id = get_post_thumbnail_id( $product->ID );
				if ( $thumbnail_id ) {
					$thumbnail_ids[] = (int) $thumbnail_id;
				}
			}
		}
		if ( $thumbnail_ids ) {
			get_posts(
				array(
					'post_type'              => 'attachment',
					'post_status'            => 'inherit',
					'post__in'               => array_values( array_unique( $thumbnail_ids ) ),
					'posts_per_page'         => count( array_unique( $thumbnail_ids ) ),
					'orderby'                => 'post__in',
					'update_post_meta_cache' => true,
					'update_post_term_cache' => false,
				)
			);
		}

		$media = new CH_Media();
		$groups = array();
		foreach ( $orders as $order ) {
			$order_items = array();
			foreach ( $items_by_order[ (int) $order->id ] ?? array() as $item ) {
				$product = $products[ (int) $item->product_id ] ?? null;
				$files = $product ? $this->entitled_files( $product->ID, $item->price_id ) : array();
				$usable_files = array_filter( $files, static function ( $file ) {
					return is_array( $file ) && isset( $file['file'] ) && is_string( $file['file'] ) && '' !== trim( $file['file'] );
				} );
				$public_files = array();
				foreach ( $usable_files as $file_key => $file ) {
					$file_name = function_exists( 'edd_get_file_name' ) ? edd_get_file_name( $file ) : basename( (string) $file['file'] );
					$public_files[] = array( 'key' => (string) $file_key, 'name' => sanitize_text_field( (string) $file_name ) );
				}
				$thumbnail = null;
				$product_url = null;
				$title = trim( sanitize_text_field( html_entity_decode( (string) $item->product_name, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) ) );
				$availability = 'product_unavailable';
				if ( $product ) {
					$title = trim( sanitize_text_field( html_entity_decode( get_the_title( $product ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) ) );
					$image = $media->featured_image( $product->ID );
					$thumbnail = is_array( $image ) && ! empty( $image['url'] ) ? $image['url'] : null;
					$product_url = '/product/' . rawurlencode( $product->post_name );
					$availability = $usable_files ? 'available' : 'no_entitled_files';
				}
				$order_items[] = array(
					'order_item_id'       => (int) $item->id,
					'product_id'          => (int) $item->product_id,
					'title'               => $title,
					'thumbnail_url'       => $thumbnail,
					'product_url'         => $product_url,
					'price_id'            => null === $item->price_id ? null : (int) $item->price_id,
					'quantity'            => max( 1, (int) $item->quantity ),
					'entitled_file_count' => count( $usable_files ),
					'availability'        => $availability,
					'download_enabled'    => ! empty( $public_files ),
					'files'               => $public_files,
				);
			}
			if ( empty( $order_items ) ) {
				continue;
			}
			$groups[] = array(
				'order_id'     => (int) $order->id,
				'order_number' => (string) $order->get_number(),
				'purchase_date'=> mysql_to_rfc3339( $order->date_created ),
				'items'        => $order_items,
			);
		}

		return $groups;
	}

	/** Return EDD's price-specific file entitlement without returning file data. */
	private function entitled_files( $product_id, $price_id ) {
		if ( class_exists( 'EDD\\Downloads\\Entitlement' ) ) {
			return ( new EDD\Downloads\Entitlement( $product_id, $price_id ) )->get_files();
		}

		$download = function_exists( 'edd_get_download' ) ? edd_get_download( $product_id ) : false;
		if ( $download && method_exists( $download, 'get_files_for_price_id' ) ) {
			return $download->get_files_for_price_id( $price_id );
		}

		return array();
	}

	private function deliverable_item_statuses() {
		return function_exists( 'edd_get_deliverable_order_item_statuses' ) ? edd_get_deliverable_order_item_statuses() : array( 'complete', 'partially_refunded' );
	}

	/** Match the logged-in WordPress user to EDD's customer record and completed parent order. */
	private function is_customer_order_eligible( $order, $customer ) {
		if ( ! $order || 'sale' !== (string) $order->type || ! in_array( (string) $order->status, array( 'complete', 'partially_refunded' ), true ) || (int) $order->customer_id !== (int) $customer->id ) { return false; }
		$user_id = get_current_user_id();
		if ( ! $user_id || (int) $customer->user_id !== $user_id || ( ! empty( $order->user_id ) && (int) $order->user_id !== $user_id ) ) { return false; }
		$gateway = (string) ( $order->gateway ?? '' );
		$is_custom_order = 'ch_razorpay' === $gateway || ( '' === $gateway && $this->has_custom_payment_markers( (int) $order->id ) );
		if ( $is_custom_order ) {
			if ( ! $this->payment_controller || ! $this->payment_controller->has_verified_custom_payment_association( (int) $order->id, $order ) ) { return false; }
			if ( '1' === (string) edd_get_order_meta( (int) $order->id, 'ch_razorpay_full_refund_verified', true ) || 'refunded' === (string) $order->status ) { return false; }
		}
		return true;
	}

	/** Distinguish legacy EDD orders with no gateway from custom orders whose gateway was not recorded. */
	private function has_custom_payment_markers( $order_id ) {
		foreach ( array( 'ch_payment_authorization_hash', 'ch_checkout_type', 'ch_razorpay_order_id', 'ch_razorpay_verified_payment_id', 'ch_razorpay_verified_payment_status', 'ch_razorpay_amount_paise' ) as $meta_key ) {
			if ( '' !== (string) edd_get_order_meta( $order_id, $meta_key, true ) ) { return true; }
		}
		return false;
	}
}
