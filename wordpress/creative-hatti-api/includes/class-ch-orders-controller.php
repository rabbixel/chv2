<?php
/**
 * Authenticated EDD order history endpoints.
 *
 * @package CreativeHattiAPI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class CH_Orders_Controller {
	private $auth_controller;

	public function __construct( CH_Auth_Controller $auth_controller ) {
		$this->auth_controller = $auth_controller;
	}

	public function register_routes() {
		register_rest_route(
			CH_API::NAMESPACE,
			'/customer/orders',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'list_orders' ),
				'permission_callback' => array( $this->auth_controller, 'session_permission' ),
				'args'                => array(
					'page'     => array( 'default' => 1, 'validate_callback' => array( $this, 'validate_positive_integer' ) ),
					'per_page' => array( 'default' => 20, 'validate_callback' => array( $this, 'validate_page_size' ) ),
				),
			)
		);

		register_rest_route(
			CH_API::NAMESPACE,
			'/customer/orders/(?P<order_id>[0-9]+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_order' ),
				'permission_callback' => array( $this->auth_controller, 'session_permission' ),
				'args'                => array(
					'order_id' => array( 'required' => true, 'validate_callback' => array( $this, 'validate_positive_integer' ) ),
				),
			)
		);
	}

	public function validate_positive_integer( $value ) {
		return is_scalar( $value ) && preg_match( '/^[1-9][0-9]{0,4}$/D', (string) $value );
	}

	public function validate_page_size( $value ) {
		return is_scalar( $value ) && preg_match( '/^[1-9][0-9]{0,2}$/D', (string) $value ) && (int) $value <= 50;
	}

	public function list_orders( $request ) {
		$customer = $this->current_customer();
		if ( is_wp_error( $customer ) ) {
			return CH_API::error( 'edd_unavailable', 'Order history is temporarily unavailable.', 503 );
		}
		if ( ! $customer ) {
			$page      = absint( $request->get_param( 'page' ) );
			$page_size = absint( $request->get_param( 'per_page' ) );
			return CH_API::collection( array(), array( 'page' => $page ? $page : 1, 'page_size' => $page_size ? min( 50, $page_size ) : 20, 'total_items' => 0, 'total_pages' => 0, 'has_next_page' => false, 'has_prev_page' => false ) );
		}

		$page     = absint( $request->get_param( 'page' ) );
		$page     = $page ? $page : 1;
		$page_size = absint( $request->get_param( 'per_page' ) );
		$page_size = $page_size ? min( 50, $page_size ) : 20;
		$args     = array(
			'customer_id' => (int) $customer->id,
			'type'        => 'sale',
			'type__not_in'=> array( 'refund' ),
			'status__not_in' => array( 'trash' ),
		);
		$total = edd_count_orders( $args );
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

		return CH_API::collection(
			$this->transform_orders( $orders ),
			array(
				'page'           => $page,
				'page_size'      => $page_size,
				'total_items'    => (int) $total,
				'total_pages'    => (int) ceil( $total / $page_size ),
				'has_next_page'  => $page * $page_size < $total,
				'has_prev_page'  => $page > 1 && $total > 0,
			)
		);
	}

	public function get_order( $request ) {
		$customer = $this->current_customer();
		if ( is_wp_error( $customer ) ) {
			return CH_API::error( 'edd_unavailable', 'Order history is temporarily unavailable.', 503 );
		}
		if ( ! $customer ) {
			return CH_API::error( 'order_not_found', 'Order not found.', 404 );
		}

		$order = edd_get_order( absint( $request->get_param( 'order_id' ) ) );
		if ( ! $order instanceof EDD\Orders\Order || 'sale' !== $order->type || (int) $order->customer_id !== (int) $customer->id || 'trash' === $order->status ) {
			return CH_API::error( 'order_not_found', 'Order not found.', 404 );
		}

		return CH_API::success( $this->transform_orders( array( $order ) )[0] );
	}

	private function current_customer() {
		if ( ! function_exists( 'edd_get_customer_by' ) || ! function_exists( 'edd_get_orders' ) || ! function_exists( 'edd_count_orders' ) ) {
			return new WP_Error( 'edd_unavailable', 'EDD order APIs unavailable.' );
		}

		$user_id  = get_current_user_id();
		$customer = $user_id ? edd_get_customer_by( 'user_id', $user_id ) : false;
		if ( ! $customer || (int) $customer->user_id !== (int) $user_id || empty( $customer->id ) ) {
			return false;
		}

		return $customer;
	}

	private function transform_orders( $orders ) {
		$orders = array_values( array_filter( (array) $orders, static function ( $order ) {
			return $order instanceof EDD\Orders\Order;
		} ) );
		if ( empty( $orders ) ) {
			return array();
		}

		$order_ids = array_map( static function ( $order ) { return (int) $order->id; }, $orders );
		$items     = edd_get_order_items(
			array(
				'order_id__in' => $order_ids,
				'number'       => 1000,
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
					'post_status'            => array( 'publish', 'private', 'draft', 'pending' ),
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

		$refunds_by_parent = array();
		if ( function_exists( 'edd_get_orders' ) ) {
			$refunds = edd_get_orders(
				array(
					'type'          => 'refund',
					'parent__in'    => $order_ids,
					'number'        => 1000,
					'orderby'       => array( 'date_created' => 'ASC', 'id' => 'ASC' ),
					'order'         => 'ASC',
					'no_found_rows' => true,
				)
			);
			foreach ( (array) $refunds as $refund ) {
				if ( $refund instanceof EDD\Orders\Order ) {
					$refunds_by_parent[ (int) $refund->parent ][] = $refund;
				}
			}
		}

		$adjustments_by_order = array();
		if ( function_exists( 'edd_get_order_adjustments' ) ) {
			$adjustments = edd_get_order_adjustments(
				array(
					'object_id__in' => $order_ids,
					'object_type'   => 'order',
					'number'        => 1000,
					'orderby'       => array( 'object_id' => 'ASC', 'id' => 'ASC' ),
					'order'         => 'ASC',
					'no_found_rows' => true,
				)
			);
			foreach ( (array) $adjustments as $adjustment ) {
				$adjustments_by_order[ (int) $adjustment->object_id ][] = $adjustment;
			}
		}

		$media = new CH_Media();
		$result = array();
		foreach ( $orders as $order ) {
			$currency = strtoupper( sanitize_text_field( (string) $order->currency ) );
			$order_items = array();
			foreach ( $items_by_order[ (int) $order->id ] ?? array() as $item ) {
				$product = $products[ (int) $item->product_id ] ?? null;
				$thumbnail = null;
				$product_url = null;
				if ( $product ) {
					$image = $media->attachment( get_post_thumbnail_id( $product->ID ), 'medium' );
					$thumbnail = is_array( $image ) && ! empty( $image['url'] ) ? $image['url'] : null;
					$product_url = '/product/' . rawurlencode( $product->post_name );
				}
				$order_items[] = array(
					'product_id'   => (int) $item->product_id,
					'name'         => sanitize_text_field( (string) $item->product_name ),
					'quantity'     => max( 1, (int) $item->quantity ),
					'unit_price'   => $this->money( $item->amount, $currency ),
					'line_total'   => $this->money( $item->total, $currency ),
					'price_id'     => null === $item->price_id ? null : (int) $item->price_id,
					'thumbnail_url'=> $thumbnail,
					'product_url'  => $product_url,
				);
			}

			$refunds = array();
			foreach ( $refunds_by_parent[ (int) $order->id ] ?? array() as $refund ) {
				$refunds[] = array(
					'id'         => (int) $refund->id,
					'number'     => (string) $refund->get_number(),
					'date'       => mysql_to_rfc3339( $refund->date_created ),
					'status'     => sanitize_key( (string) $refund->status ),
					'subtotal'   => $this->money( $refund->subtotal, $currency ),
					'discount'   => $this->money( $refund->discount, $currency ),
					'tax'        => $this->money( $refund->tax, $currency ),
					'total'      => $this->money( $refund->total, $currency ),
				);
			}

			$order_adjustments = array();
			foreach ( $adjustments_by_order[ (int) $order->id ] ?? array() as $adjustment ) {
				$order_adjustments[] = array(
					'type'     => sanitize_key( (string) $adjustment->type ),
					'subtotal' => $this->money( $adjustment->subtotal, $currency ),
					'tax'      => $this->money( $adjustment->tax, $currency ),
					'total'    => $this->money( $adjustment->total, $currency ),
				);
			}

			$gateway = sanitize_key( (string) $order->gateway );
			$gateways = function_exists( 'edd_get_payment_gateways' ) ? edd_get_payment_gateways() : array();
			$method = isset( $gateways[ $gateway ]['checkout_label'] ) ? sanitize_text_field( $gateways[ $gateway ]['checkout_label'] ) : ( isset( $gateways[ $gateway ]['admin_label'] ) ? sanitize_text_field( $gateways[ $gateway ]['admin_label'] ) : ( '' !== $gateway ? ucwords( str_replace( array( '_', '-' ), ' ', $gateway ) ) : '' ) );
			$result[] = array(
				'id'             => (int) $order->id,
				'number'         => (string) $order->get_number(),
				'date'           => mysql_to_rfc3339( $order->date_created ),
				'status'         => sanitize_key( (string) $order->status ),
				'currency'       => $currency,
				'subtotal'       => $this->money( $order->subtotal, $currency ),
				'discount'       => $this->money( $order->discount, $currency ),
				'tax'            => $this->money( $order->tax, $currency ),
				'total'          => $this->money( $order->total, $currency ),
				'payment_method' => $method,
				'items'          => $order_items,
				'refunds'        => $refunds,
				'adjustments'    => $order_adjustments,
			);
		}

		return $result;
	}

	private function money( $amount, $currency ) {
		return array(
			'amount'   => (int) round( (float) $amount * 100 ),
			'currency' => $currency,
		);
	}
}
