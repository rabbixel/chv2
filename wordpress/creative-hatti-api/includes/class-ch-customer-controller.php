<?php
/**
 * Authenticated customer profile and EDD Software Licensing endpoints.
 *
 * @package CreativeHattiAPI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class CH_Customer_Controller {
	private $auth_controller;

	public function __construct( CH_Auth_Controller $auth_controller ) {
		$this->auth_controller = $auth_controller;
	}

	public function register_routes() {
		register_rest_route(
			CH_API::NAMESPACE,
			'/customer/profile',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_profile' ),
					'permission_callback' => array( $this->auth_controller, 'session_permission' ),
				),
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'update_profile' ),
					'permission_callback' => array( $this->auth_controller, 'session_permission' ),
					'args'                => array(
						'first_name' => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_text_field', 'validate_callback' => array( $this, 'validate_first_name' ) ),
						'last_name'  => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_text_field', 'validate_callback' => array( $this, 'validate_last_name' ) ),
					),
				)
			)
		);

		register_rest_route(
			CH_API::NAMESPACE,
			'/customer/licenses',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'list_licenses' ),
				'permission_callback' => array( $this->auth_controller, 'session_permission' ),
				'args'                => array(
					'page'     => array( 'default' => 1, 'validate_callback' => array( $this, 'validate_positive_integer' ) ),
					'per_page' => array( 'default' => 20, 'validate_callback' => array( $this, 'validate_page_size' ) ),
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

	public function validate_first_name( $value ) {
		return is_string( $value ) && '' !== trim( sanitize_text_field( $value ) ) && strlen( $value ) <= 200;
	}

	public function validate_last_name( $value ) {
		return is_string( $value ) && strlen( $value ) <= 200;
	}

	public function get_profile() {
		$user = wp_get_current_user();
		if ( ! $user || empty( $user->ID ) ) {
			return CH_API::error( 'invalid_session', 'Authentication required.', 401 );
		}

		return CH_API::success( array( 'profile' => $this->profile_data( $user ) ) );
	}

	public function update_profile( $request ) {
		$user_id    = get_current_user_id();
		$first_name = $request->get_param( 'first_name' );
		$last_name  = $request->get_param( 'last_name' );
		if ( ! $user_id || ! $this->validate_first_name( $first_name ) || ! $this->validate_last_name( $last_name ) ) {
			return CH_API::error( 'invalid_profile', 'Please enter a valid first and last name.', 400 );
		}

		$updated = wp_update_user(
			array(
				'ID'           => $user_id,
				'first_name'   => sanitize_text_field( $first_name ),
				'last_name'    => sanitize_text_field( $last_name ),
				'display_name' => trim( sanitize_text_field( $first_name ) . ' ' . sanitize_text_field( $last_name ) ),
			)
		);
		if ( is_wp_error( $updated ) ) {
			return CH_API::error( 'profile_update_failed', 'Profile could not be updated.', 400 );
		}

		$updated_user = get_user_by( 'id', $user_id );
		if ( ! $updated_user ) {
			return CH_API::error( 'profile_update_failed', 'Profile could not be loaded.', 500 );
		}
		return CH_API::success( array( 'profile' => $this->profile_data( $updated_user ) ) );
	}

	public function list_licenses( $request ) {
		$identity = $this->current_customer();
		if ( is_wp_error( $identity ) ) {
			return CH_API::error( 'licensing_unavailable', 'License records are temporarily unavailable.', 503 );
		}

		$page      = max( 1, absint( $request->get_param( 'page' ) ) );
		$page_size = min( 50, max( 1, absint( $request->get_param( 'per_page' ) ) ) );
		if ( ! $identity ) {
			return CH_API::collection( array(), $this->pagination( $page, $page_size, 0 ) );
		}

		$licenses_db = edd_software_licensing()->licenses_db;
		$filter      = array( 'customer_id' => (int) $identity->customer->id );
		$total       = (int) $licenses_db->count( $filter );
		$license_ids = $licenses_db->get_licenses(
			array_merge(
				$filter,
				array(
					'number'  => $page_size,
					'offset'  => ( $page - 1 ) * $page_size,
					'orderby' => 'id',
					'order'   => 'DESC',
					'fields'  => 'ids',
				)
			)
		);
		$licenses = array();
		foreach ( (array) $license_ids as $license_id ) {
			$row = $licenses_db->get( $license_id );
			if ( $row && (int) $row->customer_id === (int) $identity->customer->id ) {
				$licenses[] = $row;
			}
		}

		return CH_API::collection( $this->transform_licenses( $licenses ), $this->pagination( $page, $page_size, $total ) );
	}

	private function current_customer() {
		if ( ! function_exists( 'edd_get_customer_by' ) ) {
			return new WP_Error( 'edd_unavailable', 'EDD customer API unavailable.' );
		}
		if ( ! function_exists( 'edd_software_licensing' ) || ! edd_software_licensing() || empty( edd_software_licensing()->licenses_db ) ) {
			return new WP_Error( 'licensing_unavailable', 'EDD Software Licensing API unavailable.' );
		}

		$user_id  = get_current_user_id();
		$customer = $user_id ? edd_get_customer_by( 'user_id', $user_id ) : false;
		if ( ! $customer || (int) $customer->user_id !== (int) $user_id || empty( $customer->id ) ) {
			return false;
		}

		return (object) array( 'user_id' => $user_id, 'customer' => $customer );
	}

	private function transform_licenses( $licenses ) {
		$rows        = array();
		$product_ids = array();
		foreach ( (array) $licenses as $license ) {
			if ( ! is_object( $license ) || empty( $license->id ) ) {
				continue;
			}
			$product_ids[] = (int) $license->download_id;
		}
		$products = array();
		if ( $product_ids ) {
			foreach ( get_posts( array( 'post_type' => 'download', 'post_status' => array( 'publish', 'draft', 'pending', 'private' ), 'post__in' => array_values( array_unique( $product_ids ) ), 'posts_per_page' => count( array_unique( $product_ids ) ), 'orderby' => 'post__in' ) ) as $product ) {
				$products[ (int) $product->ID ] = $product;
			}
		}

		foreach ( (array) $licenses as $license ) {
			if ( ! is_object( $license ) || empty( $license->id ) ) {
				continue;
			}
			$product = $products[ (int) $license->download_id ] ?? null;
			$limit   = $this->activation_limit( $license );
			$count   = $this->activation_count( $license );
			$status  = sanitize_key( $license->status );
			$expiry  = absint( $license->expiration );
			if ( 'disabled' !== $status ) {
				if ( $expiry && $expiry < current_time( 'timestamp', true ) ) {
					$status = 'expired';
				} elseif ( 'expired' === $status ) {
					$status = $count > 0 ? 'active' : 'inactive';
				}
			}
			$published = $product && 'publish' === $product->post_status;
			$rows[]  = array(
				'id'               => (int) $license->id,
				'product_id'       => (int) $license->download_id,
				'product_title'    => $product ? sanitize_text_field( get_the_title( $product ) ) : 'Product no longer available',
				'product_url'      => $published ? '/product/' . rawurlencode( $product->post_name ) : null,
				'product_available'=> (bool) $published,
				'status'           => $status,
				'purchase_id'      => (int) $license->payment_id,
				'purchase_number'  => $this->purchase_number( (int) $license->payment_id ),
				'activation_count' => $count,
				'activation_limit' => $limit > 0 ? $limit : null,
				'expires_at'       => $expiry ? gmdate( 'c', $expiry ) : null,
				'lifetime'         => ! $expiry,
				'masked_key'       => $this->mask_key( (string) $license->license_key ),
			);
		}

		return $rows;
	}

	private function purchase_number( $payment_id ) {
		if ( ! $payment_id || ! function_exists( 'edd_get_order' ) ) {
			return null;
		}
		$order = edd_get_order( $payment_id );
		return $order && method_exists( $order, 'get_number' ) ? (string) $order->get_number() : (string) $payment_id;
	}

	/** Read entitlement limits directly through EDD SL APIs without constructing a license object (which backfills rows). */
	private function activation_limit( $license ) {
		$sl       = edd_software_licensing();
		$override = $sl->license_meta_db->get_meta( (int) $license->id, '_edd_sl_limit', true );
		if ( is_numeric( $override ) ) {
			return max( 0, (int) $override );
		}
		if ( ! empty( $license->parent ) ) {
			$parent = $sl->licenses_db->get( (int) $license->parent );
			if ( $parent && (int) $parent->customer_id === (int) $license->customer_id ) {
				return $this->activation_limit( $parent );
			}
		}
		$download = class_exists( 'EDD_SL_Download' ) ? new EDD_SL_Download( (int) $license->download_id ) : false;
		return $download && method_exists( $download, 'get_activation_limit' ) ? max( 0, (int) $download->get_activation_limit( $license->price_id ) ) : 0;
	}

	/** Count active license activations using the extension's read-only activation query. */
	private function activation_count( $license ) {
		$sl = edd_software_licensing();
		if ( $sl->force_increase() ) {
			$count = $sl->license_meta_db->get_meta( (int) $license->id, '_edd_sl_activation_count', true );
			if ( is_numeric( $count ) ) {
				return max( 0, (int) $count );
			}
		}
		return (int) $sl->activations_db->count( array( 'license_id' => (int) $license->id, 'activated' => 1, 'is_local' => array( 0, 1 ) ) );
	}

	private function mask_key( $key ) {
		$key = trim( $key );
		if ( '' === $key ) {
			return null;
		}
		$visible = min( 4, strlen( $key ) );
		return str_repeat( '•', min( 12, max( 8, strlen( $key ) - $visible ) ) ) . substr( $key, -$visible );
	}

	private function pagination( $page, $page_size, $total ) {
		$total_pages = (int) ceil( $total / $page_size );
		return array(
			'page'          => (int) $page,
			'page_size'     => (int) $page_size,
			'total_items'   => (int) $total,
			'total_pages'   => $total_pages,
			'has_next_page' => $page * $page_size < $total,
			'has_prev_page' => $page > 1 && $total > 0,
		);
	}

	private function profile_data( $user ) {
		return array(
			'email'      => (string) $user->user_email,
			'first_name' => (string) get_user_meta( $user->ID, 'first_name', true ),
			'last_name'  => (string) get_user_meta( $user->ID, 'last_name', true ),
			'display_name' => (string) $user->display_name,
			'created_at' => (string) $user->user_registered,
		);
	}
}
