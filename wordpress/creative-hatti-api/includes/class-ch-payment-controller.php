<?php
/** Razorpay test-mode order creation. This controller never verifies or captures payment. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class CH_Payment_Controller {
	private $auth;

	public function __construct( $auth ) { $this->auth = $auth; }

	public function register_routes() {
		register_rest_route( CH_API::NAMESPACE, '/payment/razorpay/order', array(
			'methods' => WP_REST_Server::CREATABLE,
			'callback' => array( $this, 'create_order' ),
			'permission_callback' => array( $this, 'bridge_permission' ),
		) );
		register_rest_route( CH_API::NAMESPACE, '/payment/razorpay/verify', array(
			'methods' => WP_REST_Server::CREATABLE,
			'callback' => array( $this, 'verify_payment' ),
			'permission_callback' => array( $this, 'bridge_permission' ),
		) );
	}

	/** Verify a Checkout callback with Razorpay and record payment state without fulfilling the EDD order. */
	public function verify_payment( $request ) {
		$order_id = absint( $request->get_param( 'order_id' ) );
		$token = (string) $request->get_param( 'authorization_token' );
		$payment_id = sanitize_text_field( (string) $request->get_param( 'razorpay_payment_id' ) );
		$claimed_order_id = sanitize_text_field( (string) $request->get_param( 'razorpay_order_id' ) );
		$signature = sanitize_text_field( (string) $request->get_param( 'razorpay_signature' ) );
		if ( ! $order_id || ! preg_match( '/^[a-f0-9]{64}$/D', $token ) || ! preg_match( '/^pay_[A-Za-z0-9]+$/D', $payment_id ) || ! preg_match( '/^order_[A-Za-z0-9]+$/D', $claimed_order_id ) || ! preg_match( '/^[a-f0-9]{64}$/D', $signature ) ) {
			return $this->private_response( CH_API::error( 'payment_verification_invalid', 'Payment verification details are invalid.', 400 ) );
		}
		$order = edd_get_order( $order_id );
		$stored_hash = (string) edd_get_order_meta( $order_id, 'ch_payment_authorization_hash', true );
		$stored_order_id = (string) edd_get_order_meta( $order_id, 'ch_razorpay_order_id', true );
		if ( ! $order || ! $stored_hash || ! hash_equals( $stored_hash, hash( 'sha256', $token ) ) || ! hash_equals( $stored_order_id, $claimed_order_id ) ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment verification.', 404 ) );
		}
		$user_id = get_current_user_id();
		if ( ! empty( $order->user_id ) && (int) $order->user_id !== (int) $user_id ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment verification.', 404 ) );
		}
		if ( 'sale' !== $order->type || 'pending' !== $order->status || 'INR' !== strtoupper( (string) $order->currency ) || 'INR' !== strtoupper( (string) edd_get_currency() ) ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment verification.', 409 ) );
		}
		$key_id = defined( 'CH_RAZORPAY_TEST_KEY_ID' ) ? (string) CH_RAZORPAY_TEST_KEY_ID : (string) getenv( 'CH_RAZORPAY_TEST_KEY_ID' );
		$key_secret = defined( 'CH_RAZORPAY_TEST_KEY_SECRET' ) ? (string) CH_RAZORPAY_TEST_KEY_SECRET : (string) getenv( 'CH_RAZORPAY_TEST_KEY_SECRET' );
		if ( ! preg_match( '/^rzp_test_[A-Za-z0-9]+$/D', $key_id ) || strlen( $key_secret ) < 8 ) {
			return $this->private_response( CH_API::error( 'payment_unavailable', 'Payment verification is temporarily unavailable.', 503 ) );
		}
		$expected_signature = hash_hmac( 'sha256', $stored_order_id . '|' . $payment_id, $key_secret );
		if ( ! hash_equals( $expected_signature, $signature ) ) {
			return $this->private_response( CH_API::error( 'payment_signature_invalid', 'Payment verification failed.', 400 ) );
		}
		$amount = $this->to_paise( $order->total );
		$stored_amount = (int) edd_get_order_meta( $order_id, 'ch_razorpay_amount_paise', true );
		if ( false === $amount || $amount < 1 || $stored_amount !== $amount ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment verification.', 409 ) );
		}
		global $wpdb;
		$lock_name = 'ch_rzpv_' . $order_id;
		if ( '1' !== (string) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 5)', $lock_name ) ) ) {
			return $this->private_response( CH_API::error( 'payment_busy', 'Payment verification is busy. Retry shortly.', 503 ) );
		}
		try {
			$recorded_payment = (string) edd_get_order_meta( $order_id, 'ch_razorpay_verified_payment_id', true );
			$recorded_status = (string) edd_get_order_meta( $order_id, 'ch_razorpay_verified_payment_status', true );
			if ( '' !== $recorded_payment ) {
				if ( ! hash_equals( $recorded_payment, $payment_id ) ) { return $this->private_response( CH_API::error( 'payment_already_verified', 'A different payment is already recorded for this order.', 409 ) ); }
				if ( 'captured' === $recorded_status ) { return $this->private_response( CH_API::success( array( 'status' => 'captured', 'verified' => true, 'fulfilled' => false, 'edd_order_reference' => (string) $order->get_number() ) ) ); }
			}
			$response = wp_remote_get( 'https://api.razorpay.com/v1/payments/' . rawurlencode( $payment_id ), array(
				'timeout' => 20, 'redirection' => 0,
				'headers' => array( 'Authorization' => 'Basic ' . base64_encode( $key_id . ':' . $key_secret ), 'Accept' => 'application/json' ),
			) );
			if ( is_wp_error( $response ) ) { return $this->private_response( CH_API::error( 'payment_provider_unavailable', 'Payment status could not be verified. Please retry.', 503 ) ); }
			$status_code = (int) wp_remote_retrieve_response_code( $response );
			$payment = json_decode( wp_remote_retrieve_body( $response ), true );
			if ( $status_code < 200 || $status_code >= 300 || ! is_array( $payment ) ) { return $this->private_response( CH_API::error( 'payment_provider_unavailable', 'Payment status could not be verified. Please retry.', 503 ) ); }
			if ( (string) ( $payment['id'] ?? '' ) !== $payment_id || (string) ( $payment['order_id'] ?? '' ) !== $stored_order_id || (int) ( $payment['amount'] ?? 0 ) !== $amount || 'INR' !== strtoupper( (string) ( $payment['currency'] ?? '' ) ) ) {
				return $this->private_response( CH_API::error( 'payment_details_mismatch', 'Payment details do not match this order.', 409 ) );
			}
			$payment_status = sanitize_key( (string) ( $payment['status'] ?? '' ) );
			if ( ! in_array( $payment_status, array( 'authorized', 'captured' ), true ) ) {
				return $this->private_response( CH_API::error( 'payment_not_authorized', 'Razorpay has not authorized this payment.', 409 ) );
			}
			if ( ( 'captured' === $payment_status ) !== ! empty( $payment['captured'] ) ) {
				return $this->private_response( CH_API::error( 'payment_details_mismatch', 'Payment details do not match this order.', 409 ) );
			}
			if ( ! $this->persist_order_meta( $order_id, 'ch_razorpay_verified_payment_status', $payment_status ) || ! $this->persist_order_meta( $order_id, 'ch_razorpay_verified_at', gmdate( 'c' ) ) || ! $this->persist_order_meta( $order_id, 'ch_razorpay_verified_payment_id', $payment_id ) ) {
				return $this->private_response( CH_API::error( 'payment_record_failed', 'Payment was verified but could not be recorded. Contact support.', 500 ) );
			}
			return $this->private_response( CH_API::success( array( 'status' => $payment_status, 'verified' => true, 'fulfilled' => false, 'edd_order_reference' => (string) $order->get_number() ) ) );
		} finally {
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
		}
	}

	public function bridge_permission( $request ) {
		$bridge = $this->auth->bridge_permission( $request );
		if ( true !== $bridge ) { return $bridge; }
		return '' !== (string) $request->get_header( 'authorization' ) ? $this->auth->session_permission( $request ) : true;
	}

	public function create_order( $request ) {
		$order_id = absint( $request->get_param( 'order_id' ) );
		$token = (string) $request->get_param( 'authorization_token' );
		if ( ! $order_id || ! preg_match( '/^[a-f0-9]{64}$/D', $token ) || ! function_exists( 'edd_get_order' ) || ! function_exists( 'edd_get_order_meta' ) ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment.', 404 ) );
		}
		$order = edd_get_order( $order_id );
		$stored_hash = (string) edd_get_order_meta( $order_id, 'ch_payment_authorization_hash', true );
		if ( ! $order || ! $stored_hash || ! hash_equals( $stored_hash, hash( 'sha256', $token ) ) ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment.', 404 ) );
		}
		$user_id = get_current_user_id();
		if ( ! empty( $order->user_id ) && (int) $order->user_id !== (int) $user_id ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment.', 404 ) );
		}
		if ( 'sale' !== $order->type || 'pending' !== $order->status || strtoupper( (string) $order->currency ) !== 'INR' || strtoupper( (string) edd_get_currency() ) !== 'INR' ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment.', 409 ) );
		}
		$amount = $this->to_paise( $order->total );
		if ( false === $amount || $amount < 1 ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment.', 409 ) );
		}
		$key_id = defined( 'CH_RAZORPAY_TEST_KEY_ID' ) ? (string) CH_RAZORPAY_TEST_KEY_ID : (string) getenv( 'CH_RAZORPAY_TEST_KEY_ID' );
		$key_secret = defined( 'CH_RAZORPAY_TEST_KEY_SECRET' ) ? (string) CH_RAZORPAY_TEST_KEY_SECRET : (string) getenv( 'CH_RAZORPAY_TEST_KEY_SECRET' );
		if ( ! preg_match( '/^rzp_test_[A-Za-z0-9]+$/D', $key_id ) || strlen( $key_secret ) < 8 ) {
			return $this->private_response( CH_API::error( 'payment_unavailable', 'Online payment is temporarily unavailable.', 503 ) );
		}

		global $wpdb;
		$lock_name = 'ch_rzp_' . $order_id;
		if ( '1' !== (string) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 5)', $lock_name ) ) ) {
			return $this->private_response( CH_API::error( 'payment_busy', 'Payment setup is busy. Retry shortly.', 503 ) );
		}
		try {
			$order = edd_get_order( $order_id );
			$locked_hash = $order ? (string) edd_get_order_meta( $order_id, 'ch_payment_authorization_hash', true ) : '';
			$locked_user_id = get_current_user_id();
			if ( ! $order || ! $locked_hash || ! hash_equals( $locked_hash, hash( 'sha256', $token ) ) || ( ! empty( $order->user_id ) && (int) $order->user_id !== (int) $locked_user_id ) || 'sale' !== $order->type || 'pending' !== $order->status || strtoupper( (string) $order->currency ) !== 'INR' || strtoupper( (string) edd_get_currency() ) !== 'INR' ) {
				return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment.', 409 ) );
			}
			$amount = $this->to_paise( $order->total );
			if ( false === $amount || $amount < 1 ) { return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment.', 409 ) ); }
			$existing_id = (string) edd_get_order_meta( $order_id, 'ch_razorpay_order_id', true );
			if ( preg_match( '/^order_[A-Za-z0-9]+$/D', $existing_id ) ) {
				$existing_amount = (int) edd_get_order_meta( $order_id, 'ch_razorpay_amount_paise', true );
				if ( $existing_amount !== $amount ) { return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment.', 409 ) ); }
				return $this->private_response( CH_API::success( $this->payload( $key_id, $existing_id, $amount, $order ) ) );
			}
			$state = (string) edd_get_order_meta( $order_id, 'ch_razorpay_creation_state', true );
			if ( in_array( $state, array( 'creating', 'uncertain' ), true ) ) {
				return $this->private_response( CH_API::error( 'payment_creation_uncertain', 'Payment setup needs reconciliation before it can be retried.', 503 ) );
			}
			$attempt_key = 'ch_rzp_attempts_' . $order_id;
			$attempts = function_exists( 'get_transient' ) ? (int) get_transient( $attempt_key ) : 0;
			if ( $attempts >= 5 ) { return $this->private_response( CH_API::error( 'payment_rate_limited', 'Payment setup has been retried too many times. Please try later.', 429 ) ); }
			if ( function_exists( 'set_transient' ) ) { set_transient( $attempt_key, $attempts + 1, HOUR_IN_SECONDS ); }
			edd_update_order_meta( $order_id, 'ch_razorpay_creation_state', 'creating' );
			$response = wp_remote_post( 'https://api.razorpay.com/v1/orders', array(
				'timeout' => 20, 'redirection' => 0,
				'headers' => array( 'Authorization' => 'Basic ' . base64_encode( $key_id . ':' . $key_secret ), 'Content-Type' => 'application/json' ),
				'body' => wp_json_encode( array( 'amount' => $amount, 'currency' => 'INR', 'receipt' => 'ch-' . $order_id, 'notes' => array( 'ch_integration' => 'creative-hatti-api-test', 'ch_edd_order_id' => (string) $order_id ) ) ),
			) );
			if ( is_wp_error( $response ) ) {
				edd_update_order_meta( $order_id, 'ch_razorpay_creation_state', 'uncertain' );
				return $this->private_response( CH_API::error( 'payment_creation_uncertain', 'Payment setup outcome is unknown. Please contact support before retrying.', 503 ) );
			}
			$status = (int) wp_remote_retrieve_response_code( $response );
			$body = json_decode( wp_remote_retrieve_body( $response ), true );
			if ( $status < 200 || $status >= 300 ) {
				$definite_rejection = $status >= 400 && $status < 500;
				edd_update_order_meta( $order_id, 'ch_razorpay_creation_state', $definite_rejection ? 'rejected' : 'uncertain' );
				return $this->private_response( CH_API::error( $definite_rejection ? 'payment_provider_rejected' : 'payment_creation_uncertain', $definite_rejection ? 'Payment provider could not prepare this order.' : 'Payment setup outcome is unknown. Please contact support before retrying.', $definite_rejection ? 502 : 503 ) );
			}
			if ( ! is_array( $body ) || ! preg_match( '/^order_[A-Za-z0-9]+$/D', (string) ( $body['id'] ?? '' ) ) || (int) ( $body['amount'] ?? 0 ) !== $amount || 'INR' !== strtoupper( (string) ( $body['currency'] ?? '' ) ) ) {
				edd_update_order_meta( $order_id, 'ch_razorpay_creation_state', 'uncertain' );
				return $this->private_response( CH_API::error( 'payment_creation_uncertain', 'Payment setup outcome is unknown. Please contact support before retrying.', 503 ) );
			}
			if ( ! $this->persist_order_meta( $order_id, 'ch_razorpay_order_id', $body['id'] ) || ! $this->persist_order_meta( $order_id, 'ch_razorpay_amount_paise', $amount ) ) {
				edd_update_order_meta( $order_id, 'ch_razorpay_creation_state', 'uncertain' );
				return $this->private_response( CH_API::error( 'payment_creation_uncertain', 'Payment setup outcome is unknown. Please contact support before retrying.', 503 ) );
			}
			edd_update_order_meta( $order_id, 'ch_razorpay_creation_state', 'created' );
			return $this->private_response( CH_API::success( $this->payload( $key_id, $body['id'], $amount, $order ) ) );
		} finally {
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
		}
	}

	private function to_paise( $amount ) {
		$value = trim( (string) $amount );
		if ( ! preg_match( '/^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/D', $value, $match ) ) { return false; }
		$fraction = $match[2] ?? '';
		if ( strlen( $fraction ) > 2 ) {
			if ( '' !== trim( substr( $fraction, 2 ), '0' ) ) { return false; }
			$fraction = substr( $fraction, 0, 2 );
		}
		$rupees = (int) $match[1];
		if ( $rupees > intdiv( PHP_INT_MAX - 99, 100 ) ) { return false; }
		return $rupees * 100 + (int) str_pad( $fraction, 2, '0' );
	}

	/** Store scalar EDD order metadata and confirm it, including when an API reports a no-op update as false. */
	private function persist_order_meta( $order_id, $key, $value ) {
		$current = edd_get_order_meta( $order_id, $key, true );
		if ( (string) $current === (string) $value ) { return true; }
		edd_update_order_meta( $order_id, $key, $value );
		return (string) edd_get_order_meta( $order_id, $key, true ) === (string) $value;
	}

	private function payload( $key_id, $order_id, $amount, $order ) {
		return array( 'key_id' => $key_id, 'razorpay_order_id' => $order_id, 'amount' => $amount, 'currency' => 'INR', 'edd_order_reference' => (string) $order->get_number() );
	}

	private function private_response( $response ) {
		$response = rest_ensure_response( $response );
		$response->header( 'Cache-Control', 'private, no-store, no-cache, max-age=0, must-revalidate' );
		$response->header( 'Pragma', 'no-cache' );
		return $response;
	}
}
