<?php
/** Razorpay test-mode order creation. This controller never verifies or captures payment. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class CH_Payment_Controller {
	private $auth;

	public function __construct( $auth ) {
		$this->auth = $auth;
		add_filter( 'edd_file_download_has_access', array( $this, 'block_verified_full_refund_download_access' ), 10, 3 );
	}

	/** Recheck verified full refunds for signed EDD URLs, including URLs issued before reconciliation. */
	public function block_verified_full_refund_download_access( $has_access, $payment_id, $args = array() ) {
		if ( ! $has_access || ! function_exists( 'edd_get_order' ) || ! function_exists( 'edd_get_order_meta' ) ) { return $has_access; }
		$order_id = 0;
		$eddfile = isset( $_GET['eddfile'] ) ? explode( ':', rawurldecode( (string) $_GET['eddfile'] ) ) : array();
		if ( ! empty( $_GET['token'] ) && count( $eddfile ) >= 3 && absint( $payment_id ) === absint( $eddfile[0] ) ) {
			$order_id = absint( $eddfile[0] );
		} elseif ( ! empty( $args['key'] ) && ! empty( $args['email'] ) && function_exists( 'edd_get_order_by' ) ) {
			$matched_order = edd_get_order_by( 'payment_key', (string) $args['key'] );
			if ( $matched_order && strtolower( trim( (string) $matched_order->email ) ) === strtolower( trim( (string) $args['email'] ) ) ) { $order_id = (int) $matched_order->id; }
		}
		if ( ! $order_id ) { return $has_access; }
		$order = $order_id ? edd_get_order( $order_id ) : false;
		if ( ! $order || 'sale' !== $order->type || ! edd_get_order_meta( $order_id, 'ch_razorpay_order_id', true ) ) { return $has_access; }
		if ( '1' === (string) edd_get_order_meta( $order_id, 'ch_razorpay_full_refund_verified', true ) ) { return false; }
		$amount = (int) edd_get_order_meta( $order_id, 'ch_razorpay_amount_paise', true );
		$refunded = (int) edd_get_order_meta( $order_id, 'ch_razorpay_refunded_amount_paise', true );
		return ( 'refunded' === $order->status && $amount > 0 && $refunded >= $amount ) ? false : $has_access;
	}

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
		register_rest_route( CH_API::NAMESPACE, '/payment/razorpay/status', array(
			'methods' => WP_REST_Server::CREATABLE,
			'callback' => array( $this, 'order_status' ),
			'permission_callback' => array( $this, 'bridge_permission' ),
		) );
		register_rest_route( CH_API::NAMESPACE, '/payment/razorpay/downloads', array(
			'methods' => WP_REST_Server::CREATABLE,
			'callback' => array( $this, 'order_downloads' ),
			'permission_callback' => array( $this, 'bridge_permission' ),
		) );
		register_rest_route( CH_API::NAMESPACE, '/payment/razorpay/download', array(
			'methods' => WP_REST_Server::CREATABLE,
			'callback' => array( $this, 'order_download_url' ),
			'permission_callback' => array( $this, 'bridge_permission' ),
		) );
		register_rest_route( CH_API::NAMESPACE, '/payment/razorpay/webhook', array(
			'methods' => WP_REST_Server::CREATABLE,
			'callback' => array( $this, 'receive_webhook' ),
			'permission_callback' => '__return_true',
		) );
	}

	/** Receive only signed notifications for orders created by this integration. */
	public function receive_webhook( $request ) {
		$secret = defined( 'CH_RAZORPAY_WEBHOOK_SECRET' ) ? (string) CH_RAZORPAY_WEBHOOK_SECRET : (string) getenv( 'CH_RAZORPAY_WEBHOOK_SECRET' );
		$raw = (string) $request->get_body();
		$signature = (string) $request->get_header( 'x-razorpay-signature' );
		if ( strlen( $secret ) < 16 ) { return CH_API::error( 'webhook_unavailable', 'Webhook processing is temporarily unavailable.', 503 ); }
		if ( '' === $raw || strlen( $raw ) > 1048576 || ! preg_match( '/^[a-f0-9]{64}$/iD', $signature ) || ! hash_equals( hash_hmac( 'sha256', $raw, $secret ), strtolower( $signature ) ) ) {
			return CH_API::error( 'webhook_signature_invalid', 'Webhook signature is invalid.', 400 );
		}
		$event = json_decode( $raw, true );
		if ( ! is_array( $event ) || empty( $event['id'] ) || ! preg_match( '/^[A-Za-z0-9_\-]{1,100}$/D', (string) $event['id'] ) || empty( $event['event'] ) || ! is_array( $event['payload'] ?? null ) ) {
			return CH_API::error( 'webhook_malformed', 'Webhook event is malformed.', 400 );
		}
		$type = (string) $event['event'];
		if ( ! in_array( $type, array( 'payment.authorized', 'payment.captured', 'payment.failed', 'order.paid', 'refund.created', 'refund.processed', 'refund.failed' ), true ) ) {
			return CH_API::success( array( 'received' => true, 'ignored' => true ) );
		}
		$is_refund_event = 0 === strpos( $type, 'refund.' );
		$entity = 'order.paid' === $type ? ( $event['payload']['order']['entity'] ?? null ) : ( $is_refund_event ? ( $event['payload']['refund']['entity'] ?? null ) : ( $event['payload']['payment']['entity'] ?? null ) );
		if ( ! is_array( $entity ) ) {
			return CH_API::error( 'webhook_malformed', 'Webhook event is malformed.', 400 );
		}
		global $wpdb;
		$razorpay_order_id = '';
		if ( $is_refund_event ) {
			$payment_entity = $event['payload']['payment']['entity'] ?? null;
			$refund_id = (string) ( $entity['id'] ?? '' );
			$payment_id = (string) ( $entity['payment_id'] ?? ( is_array( $payment_entity ) ? ( $payment_entity['id'] ?? '' ) : '' ) );
			if ( ! preg_match( '/^rfnd_[A-Za-z0-9]+$/D', $refund_id ) || ! preg_match( '/^pay_[A-Za-z0-9]+$/D', $payment_id ) || ( is_array( $payment_entity ) && (string) ( $payment_entity['id'] ?? '' ) !== $payment_id ) ) { return CH_API::error( 'webhook_malformed', 'Webhook event is malformed.', 400 ); }
			$order_id = $this->find_custom_order_id_by_payment( $payment_id );
		} else {
			if ( ! preg_match( '/^order_[A-Za-z0-9]+$/D', (string) ( 'order.paid' === $type ? ( $entity['id'] ?? '' ) : ( $entity['order_id'] ?? '' ) ) ) ) { return CH_API::error( 'webhook_malformed', 'Webhook event is malformed.', 400 ); }
			$razorpay_order_id = 'order.paid' === $type ? (string) $entity['id'] : (string) $entity['order_id'];
			$order_id = $this->find_custom_order_id( $razorpay_order_id );
		}
		if ( ! $order_id ) { return CH_API::success( array( 'received' => true, 'ignored' => true ) ); }
		$lock_name = 'ch_rzpv_' . $order_id;
		if ( '1' !== (string) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 5)', $lock_name ) ) ) { return CH_API::error( 'webhook_busy', 'Webhook processing is busy. Retry shortly.', 503 ); }
		try {
			$seen_events = edd_get_order_meta( $order_id, 'ch_razorpay_webhook_event_ids', true );
			$seen_events = is_array( $seen_events ) ? $seen_events : array();
			$event_fingerprint = hash( 'sha256', (string) $event['id'] );
			$event_seen = '1' === (string) edd_get_order_meta( $order_id, 'ch_razorpay_webhook_event_' . $event_fingerprint, true );
			if ( $event_seen || in_array( $event_fingerprint, $seen_events, true ) ) { return CH_API::success( array( 'received' => true, 'duplicate' => true ) ); }
			$order = edd_get_order( $order_id );
			if ( ! $order || 'sale' !== $order->type || 'ch_razorpay' !== (string) ( $order->gateway ?? '' ) || 'INR' !== strtoupper( (string) $order->currency ) ) { return CH_API::success( array( 'received' => true, 'ignored' => true ) ); }
			if ( $is_refund_event ) { return $this->process_refund_webhook( $order_id, $event, $type, $entity, $payment_id, $event_fingerprint ); }
			$amount = $this->to_paise( $order->total );
			if ( false === $amount || $amount !== (int) edd_get_order_meta( $order_id, 'ch_razorpay_amount_paise', true ) ) { return CH_API::error( 'webhook_order_mismatch', 'Webhook details do not match this order.', 409 ); }
			if ( 'order.paid' === $type ) {
				$authoritative = $this->fetch_razorpay_order( $razorpay_order_id );
				if ( is_wp_error( $authoritative ) ) { return CH_API::error( 'webhook_provider_unavailable', 'Payment status could not be verified. Retry shortly.', 503 ); }
				if ( (int) ( $authoritative['amount_paid'] ?? 0 ) < $amount || strtoupper( (string) ( $authoritative['currency'] ?? '' ) ) !== 'INR' ) { return CH_API::error( 'webhook_order_mismatch', 'Webhook details do not match this order.', 409 ); }
				$payment_id = (string) ( $authoritative['payments']['items'][0]['id'] ?? '' );
				$event_status = 'captured';
			} else {
				$payment_id = (string) ( $entity['id'] ?? '' );
				if ( ! preg_match( '/^pay_[A-Za-z0-9]+$/D', $payment_id ) ) { return CH_API::error( 'webhook_malformed', 'Webhook event is malformed.', 400 ); }
				$authoritative = $this->fetch_razorpay_payment( $payment_id );
				if ( is_wp_error( $authoritative ) ) { return CH_API::error( 'webhook_provider_unavailable', 'Payment status could not be verified. Retry shortly.', 503 ); }
				if ( $payment_id !== (string) ( $authoritative['id'] ?? '' ) || $razorpay_order_id !== (string) ( $authoritative['order_id'] ?? '' ) || (int) ( $authoritative['amount'] ?? 0 ) !== $amount || 'INR' !== strtoupper( (string) ( $authoritative['currency'] ?? '' ) ) ) { return CH_API::error( 'webhook_order_mismatch', 'Webhook details do not match this order.', 409 ); }
				$event_status = sanitize_key( (string) ( $authoritative['status'] ?? '' ) );
			}
			if ( ! in_array( $event_status, array( 'authorized', 'captured', 'failed' ), true ) ) { return CH_API::success( array( 'received' => true, 'ignored' => true ) ); }
			$current = (string) edd_get_order_meta( $order_id, 'ch_razorpay_verified_payment_status', true );
			$current_id = (string) edd_get_order_meta( $order_id, 'ch_razorpay_verified_payment_id', true );
			if ( '' !== $current_id && ! hash_equals( $current_id, $payment_id ) ) { return CH_API::error( 'webhook_payment_conflict', 'A different payment is recorded for this order.', 409 ); }
			$rank = array( '' => 0, 'failed' => 1, 'authorized' => 2, 'captured' => 3 );
			if ( 'captured' === $current || ( 'failed' === $current && 'authorized' === $event_status ) || ( $rank[ $event_status ] ?? 0 ) < ( $rank[ $current ] ?? 0 ) ) {
				if ( 'captured' === $current ) {
					$transaction = $this->record_captured_transaction( $order_id, $order, $payment_id );
					if ( is_wp_error( $transaction ) ) { return CH_API::error( 'webhook_record_failed', 'Verified payment could not be recorded. Retry shortly.', 503 ); }
				}
				$seen_events[] = $event_fingerprint;
				$seen_events = array_slice( array_values( array_unique( $seen_events ) ), -100 );
				if ( ! $this->persist_order_meta( $order_id, 'ch_razorpay_webhook_event_' . $event_fingerprint, '1' ) || ! $this->persist_order_meta( $order_id, 'ch_razorpay_webhook_event_ids', $seen_events ) ) { return CH_API::error( 'webhook_record_failed', 'Webhook event could not be recorded. Retry shortly.', 500 ); }
				return CH_API::success( array( 'received' => true, 'duplicate' => true ) );
			}
			$seen_events[] = $event_fingerprint;
			$seen_events = array_slice( array_values( array_unique( $seen_events ) ), -100 );
			if ( 'captured' === $event_status ) {
				$transaction = $this->record_captured_transaction( $order_id, $order, $payment_id );
				if ( is_wp_error( $transaction ) ) { return CH_API::error( 'webhook_record_failed', 'Verified payment could not be recorded. Retry shortly.', 503 ); }
			}
			if ( ! $this->persist_order_meta( $order_id, 'ch_razorpay_webhook_event_' . $event_fingerprint, '1' ) || ! $this->persist_order_meta( $order_id, 'ch_razorpay_webhook_event_ids', $seen_events ) || ! $this->persist_order_meta( $order_id, 'ch_razorpay_verified_payment_id', $payment_id ) || ! $this->persist_order_meta( $order_id, 'ch_razorpay_verified_payment_status', $event_status ) || ! $this->persist_order_meta( $order_id, 'ch_razorpay_verified_at', gmdate( 'c' ) ) || ! $this->persist_order_meta( $order_id, 'ch_razorpay_webhook_event_type', $type ) ) { return CH_API::error( 'webhook_record_failed', 'Webhook event could not be recorded. Retry shortly.', 500 ); }
			$fulfilled = 'captured' === $event_status ? $this->fulfill_captured_order( $order_id, $razorpay_order_id, $payment_id, $amount ) : false;
			if ( is_wp_error( $fulfilled ) ) { return CH_API::error( 'webhook_fulfillment_failed', 'Verified payment could not be recorded as complete. Retry shortly.', 503 ); }
			return CH_API::success( array( 'received' => true, 'recorded' => true, 'status' => $event_status, 'fulfilled' => (bool) $fulfilled ) );
		} finally { $wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) ); }
	}

	private function find_custom_order_id( $razorpay_order_id ) {
		global $wpdb;
		$table = $wpdb->prefix . 'edd_ordermeta';
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT order_id FROM {$table} WHERE meta_key = %s AND meta_value = %s LIMIT 1", 'ch_razorpay_order_id', $razorpay_order_id ) );
	}

	private function find_custom_order_id_by_payment( $payment_id ) {
		global $wpdb;
		$table = $wpdb->prefix . 'edd_ordermeta';
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT order_id FROM {$table} WHERE meta_key = %s AND meta_value = %s LIMIT 1", 'ch_razorpay_verified_payment_id', $payment_id ) );
	}

	/** Reconcile refund state using provider reads while caller holds the shared per-order lock. */
	private function process_refund_webhook( $order_id, $event, $type, $event_refund, $payment_id, $event_fingerprint ) {
		$order = edd_get_order( $order_id );
		$stored_payment_id = (string) edd_get_order_meta( $order_id, 'ch_razorpay_verified_payment_id', true );
		$stored_payment_status = (string) edd_get_order_meta( $order_id, 'ch_razorpay_verified_payment_status', true );
		$stored_order_id = (string) edd_get_order_meta( $order_id, 'ch_razorpay_order_id', true );
		$amount = $this->to_paise( $order->total );
		if ( ! $stored_order_id || ! $stored_payment_id || ! hash_equals( $stored_payment_id, $payment_id ) || ! in_array( $stored_payment_status, array( 'captured', 'refunded' ), true ) || false === $amount || $amount < 1 || $amount !== (int) edd_get_order_meta( $order_id, 'ch_razorpay_amount_paise', true ) ) { return CH_API::success( array( 'received' => true, 'ignored' => true ) ); }
		$refund_id = (string) $event_refund['id'];
		$refund_key = 'ch_razorpay_refund_' . hash( 'sha256', $refund_id );
		$record = edd_get_order_meta( $order_id, $refund_key, true );
		$record = is_array( $record ) ? $record : array();
		if ( 'processed' === ( $record['status'] ?? '' ) ) { $this->record_webhook_event( $order_id, $event, $event_fingerprint ); return CH_API::success( array( 'received' => true, 'duplicate' => true ) ); }
		if ( 'processing' === ( $record['status'] ?? '' ) && empty( $record['edd_refund_order_id'] ) ) { $record['edd_refund_order_id'] = $this->find_edd_refund_order( $order_id, $refund_id ); }

		$refund = $this->razorpay_get( 'refunds/' . rawurlencode( $refund_id ) );
		$payment = $this->fetch_razorpay_payment( $payment_id );
		if ( is_wp_error( $refund ) || is_wp_error( $payment ) ) { return CH_API::error( 'refund_provider_unavailable', 'Refund status could not be verified. Retry shortly.', 503 ); }
		$refund_status = sanitize_key( (string) ( $refund['status'] ?? '' ) );
		$refund_amount = $refund['amount'] ?? null;
		if ( (string) ( $refund['id'] ?? '' ) !== $refund_id || (string) ( $refund['payment_id'] ?? '' ) !== $payment_id || ! is_numeric( $refund_amount ) || (int) $refund_amount < 1 || (string) ( $payment['id'] ?? '' ) !== $payment_id || (string) ( $payment['order_id'] ?? '' ) !== $stored_order_id || (int) ( $payment['amount'] ?? 0 ) !== $amount || 'INR' !== strtoupper( (string) ( $payment['currency'] ?? '' ) ) || empty( $payment['captured'] ) || ! in_array( (string) ( $payment['status'] ?? '' ), array( 'captured', 'refunded' ), true ) || 'INR' !== strtoupper( (string) ( $refund['currency'] ?? '' ) ) ) { return CH_API::error( 'refund_details_mismatch', 'Refund details do not match this order.', 409 ); }
		if ( (string) ( $event_refund['payment_id'] ?? $payment_id ) !== $payment_id || ( isset( $event_refund['amount'] ) && (int) $event_refund['amount'] !== (int) $refund_amount ) ) { return CH_API::error( 'refund_event_mismatch', 'Refund event details do not match the provider record.', 409 ); }
		if ( ! in_array( $refund_status, array( 'pending', 'created', 'processed', 'failed' ), true ) ) { return CH_API::error( 'refund_provider_unavailable', 'Refund status could not be verified. Retry shortly.', 503 ); }
		if ( 'processing' === ( $record['status'] ?? '' ) && ! empty( $record['edd_refund_order_id'] ) && 'processed' !== $refund_status ) { return CH_API::error( 'refund_provider_unavailable', 'Provider refund state conflicts with an EDD record. Review required.', 503 ); }
		if ( 'refund.processed' === $type && 'processed' !== $refund_status ) { return CH_API::error( 'refund_provider_unavailable', 'Refund processing is not yet confirmed. Retry shortly.', 503 ); }
		if ( 'refund.failed' === $type && 'failed' !== $refund_status ) { return CH_API::error( 'refund_provider_unavailable', 'Refund failure is not yet confirmed. Retry shortly.', 503 ); }
		if ( 'processed' === ( $record['status'] ?? '' ) ) { return CH_API::success( array( 'received' => true, 'duplicate' => true ) ); }
		if ( 'processed' !== $refund_status ) {
			$record = array( 'refund_id' => $refund_id, 'payment_id' => $payment_id, 'amount_paise' => (int) $refund_amount, 'currency' => 'INR', 'status' => $refund_status );
			if ( ! $this->persist_order_meta( $order_id, $refund_key, $record ) || ! $this->record_webhook_event( $order_id, $event, $event_fingerprint ) ) { return CH_API::error( 'refund_record_failed', 'Refund event could not be recorded. Retry shortly.', 503 ); }
			return CH_API::success( array( 'received' => true, 'recorded' => true, 'refund_status' => $refund_status ) );
		}

		$refunded_total = (int) edd_get_order_meta( $order_id, 'ch_razorpay_refunded_amount_paise', true );
		$next_total = $refunded_total + (int) $refund_amount;
		$provider_refunded_total = (int) ( $payment['amount_refunded'] ?? 0 );
		if ( $next_total > $amount || $provider_refunded_total < $next_total ) { return CH_API::error( 'refund_amount_mismatch', 'Refund totals do not match the provider payment.', 409 ); }
		$record = array( 'refund_id' => $refund_id, 'payment_id' => $payment_id, 'amount_paise' => (int) $refund_amount, 'currency' => 'INR', 'status' => 'processing' );
		if ( ! $this->persist_order_meta( $order_id, $refund_key, $record ) ) { return CH_API::error( 'refund_record_failed', 'Refund event could not be recorded. Retry shortly.', 503 ); }
		$refund_order_id = (int) ( $record['edd_refund_order_id'] ?? 0 );
		if ( ! $refund_order_id ) { $refund_order_id = $this->find_edd_refund_order( $order_id, $refund_id ); }
		if ( ! $refund_order_id ) {
			$refund_tax_paise = $this->calculate_refund_tax_paise( $order, $next_total, (int) $refund_amount );
			if ( false === $refund_tax_paise ) { return CH_API::error( 'refund_amount_mismatch', 'Refund amount could not be reconciled to the EDD order.', 409 ); }
			$refund_order_id = $this->add_edd_refund_record( $order, $refund_id, (int) $refund_amount, $refund_tax_paise );
		}
		if ( is_wp_error( $refund_order_id ) || ! $refund_order_id ) { return CH_API::error( 'refund_record_failed', 'EDD refund record could not be created. Retry shortly.', 503 ); }
		$record['edd_refund_order_id'] = (int) $refund_order_id;
		if ( ! $this->persist_order_meta( $order_id, $refund_key, $record ) || ! $this->persist_order_meta( $refund_order_id, 'ch_razorpay_refund_id', $refund_id ) || ! $this->ensure_edd_refund_transaction( $refund_order_id, $order, $refund_id, (int) $refund_amount ) ) { return CH_API::error( 'refund_record_failed', 'EDD refund record could not be finalized. Retry shortly.', 503 ); }
		if ( $next_total >= $amount && ! $this->persist_order_meta( $order_id, 'ch_razorpay_full_refund_verified', '1' ) ) { return CH_API::error( 'refund_record_failed', 'Verified refund state could not be recorded. Retry shortly.', 503 ); }
		$new_status = $next_total >= $amount ? 'refunded' : ( in_array( $order->status, array( 'complete', 'partially_refunded' ), true ) ? 'partially_refunded' : $order->status );
		if ( $new_status !== $order->status ) {
			if ( ! function_exists( 'edd_update_order' ) ) { return CH_API::error( 'refund_record_failed', 'EDD order status could not be reconciled. Retry shortly.', 503 ); }
			edd_update_order( $order_id, array( 'status' => $new_status ) );
			$updated_order = edd_get_order( $order_id );
			if ( ! $updated_order || $new_status !== $updated_order->status ) { return CH_API::error( 'refund_record_failed', 'EDD order status could not be reconciled. Retry shortly.', 503 ); }
		}
		if ( $next_total >= $amount && ! $this->revoke_fully_refunded_order_items( $order_id ) ) { return CH_API::error( 'refund_entitlement_reconciliation_failed', 'Refunded download access could not be reconciled. Retry shortly.', 503 ); }
		$record['status'] = 'processed';
		if ( ! $this->persist_order_meta( $order_id, $refund_key, $record ) || ! $this->persist_order_meta( $order_id, 'ch_razorpay_refunded_amount_paise', $next_total ) ) { return CH_API::error( 'refund_record_failed', 'Refund record could not be finalized. Retry shortly.', 503 ); }
		if ( ! $this->record_webhook_event( $order_id, $event, $event_fingerprint ) ) { return CH_API::error( 'refund_record_failed', 'Refund event could not be recorded. Retry shortly.', 503 ); }
		return CH_API::success( array( 'received' => true, 'recorded' => true, 'refund_status' => 'processed', 'refunded_amount_paise' => $next_total, 'order_status' => $new_status ) );
	}

	/** Create a supported EDD child refund order and gateway transaction; no refund API is called. */
	private function calculate_refund_tax_paise( $order, $next_total_paise, $refund_amount_paise ) {
		$order_total_paise = $this->to_paise( $order->total );
		$order_tax_paise = $this->to_paise( $order->tax ?? '0.00' );
		if ( false === $order_total_paise || false === $order_tax_paise || $order_total_paise < 1 || $order_tax_paise > $order_total_paise ) { return false; }
		$prior_tax_paise = 0;
		if ( function_exists( 'edd_get_order_refunds' ) ) {
			foreach ( (array) edd_get_order_refunds( $order->id ) as $refund_order ) {
				if ( empty( $refund_order->id ) || ! edd_get_order_meta( $refund_order->id, 'ch_razorpay_refund_id', true ) ) { continue; }
				$tax = ltrim( (string) ( $refund_order->tax ?? '0.00' ), '-' );
				$tax_paise = $this->to_paise( $tax );
				if ( false === $tax_paise ) { return false; }
				$prior_tax_paise += $tax_paise;
			}
		}
		$target_tax_paise = min( $order_tax_paise, intdiv( ( $order_tax_paise * $next_total_paise ) + intdiv( $order_total_paise, 2 ), $order_total_paise ) );
		$refund_tax_paise = $target_tax_paise - $prior_tax_paise;
		return ( $refund_tax_paise >= 0 && $refund_tax_paise <= $refund_amount_paise ) ? $refund_tax_paise : false;
	}

	private function add_edd_refund_record( $order, $refund_id, $amount_paise, $tax_paise ) {
		if ( ! function_exists( 'edd_add_order' ) ) { return new WP_Error( 'edd_refund_api_unavailable' ); }
		$amount = number_format( $amount_paise / 100, 2, '.', '' );
		$tax = number_format( $tax_paise / 100, 2, '.', '' );
		$subtotal = number_format( ( $amount_paise - $tax_paise ) / 100, 2, '.', '' );
		$refund_order_id = edd_add_order( array(
			'parent' => (int) $order->id, 'type' => 'refund', 'status' => 'complete', 'user_id' => (int) $order->user_id,
			'customer_id' => (int) $order->customer_id, 'email' => (string) $order->email, 'gateway' => (string) $order->gateway,
			'mode' => (string) $order->mode, 'currency' => 'INR', 'payment_key' => $this->refund_payment_key( $refund_id ),
			'subtotal' => '-' . $subtotal, 'tax' => '-' . $tax, 'total' => '-' . $amount,
		) );
		if ( ! $refund_order_id ) { return new WP_Error( 'edd_refund_order_failed' ); }
		$this->persist_order_meta( $refund_order_id, 'ch_razorpay_refund_id', $refund_id );
		return (int) $refund_order_id;
	}

	private function find_edd_refund_order( $order_id, $refund_id ) {
		if ( function_exists( 'edd_get_order_refunds' ) ) {
			foreach ( (array) edd_get_order_refunds( $order_id ) as $refund_order ) {
				if ( isset( $refund_order->id ) && $refund_id === (string) edd_get_order_meta( $refund_order->id, 'ch_razorpay_refund_id', true ) ) { return (int) $refund_order->id; }
			}
		}
		if ( function_exists( 'edd_get_order_by' ) ) {
			$refund_order = edd_get_order_by( 'payment_key', $this->refund_payment_key( $refund_id ) );
			if ( $refund_order && 'refund' === $refund_order->type && (int) $refund_order->parent === (int) $order_id && 'INR' === strtoupper( (string) $refund_order->currency ) ) { return (int) $refund_order->id; }
		}
		return 0;
	}

	private function refund_payment_key( $refund_id ) { return strtolower( md5( 'ch-rzpr-' . $refund_id ) ); }

	/** Preserve all partial-refund item access; mark every line refunded only after an authoritative full refund. */
	private function revoke_fully_refunded_order_items( $order_id ) {
		if ( ! function_exists( 'edd_get_order_items' ) || ! function_exists( 'edd_update_order_item' ) || ! function_exists( 'edd_get_order_item' ) ) { return false; }
		$items = edd_get_order_items( array( 'order_id' => (int) $order_id, 'number' => 0, 'no_found_rows' => true ) );
		if ( ! is_array( $items ) || empty( $items ) ) { return false; }
		foreach ( $items as $item ) {
			if ( empty( $item->id ) ) { return false; }
			if ( 'refunded' !== (string) $item->status && false === edd_update_order_item( (int) $item->id, array( 'status' => 'refunded' ) ) ) { return false; }
			$updated_item = edd_get_order_item( (int) $item->id );
			if ( ! $updated_item || 'refunded' !== (string) $updated_item->status ) { return false; }
		}
		return true;
	}

	private function ensure_edd_refund_transaction( $refund_order_id, $order, $refund_id, $amount_paise ) {
		if ( ! function_exists( 'edd_add_order_transaction' ) ) { return false; }
		if ( function_exists( 'edd_get_order_transactions' ) ) {
			$transactions = edd_get_order_transactions( array( 'object_type' => 'order', 'object_id' => (int) $refund_order_id, 'number' => 100 ) );
			foreach ( (array) $transactions as $transaction ) { if ( isset( $transaction->transaction_id ) && hash_equals( $refund_id, (string) $transaction->transaction_id ) ) { return true; } }
		}
		$amount = number_format( $amount_paise / 100, 2, '.', '' );
		return (bool) edd_add_order_transaction( array( 'object_type' => 'order', 'object_id' => (int) $refund_order_id, 'transaction_id' => $refund_id, 'gateway' => (string) $order->gateway, 'status' => 'complete', 'total' => $amount, 'currency' => 'INR' ) );
	}

	private function record_webhook_event( $order_id, $event, $fingerprint ) {
		$ids = edd_get_order_meta( $order_id, 'ch_razorpay_webhook_event_ids', true );
		$ids = is_array( $ids ) ? $ids : array();
		$ids[] = $fingerprint;
		$ids = array_slice( array_values( array_unique( $ids ) ), -100 );
		return $this->persist_order_meta( $order_id, 'ch_razorpay_webhook_event_' . $fingerprint, '1' ) && $this->persist_order_meta( $order_id, 'ch_razorpay_webhook_event_ids', $ids );
	}

	private function fetch_razorpay_payment( $payment_id ) { return $this->razorpay_get( 'payments/' . rawurlencode( $payment_id ) ); }
	private function fetch_razorpay_order( $order_id ) { return $this->razorpay_get( 'orders/' . rawurlencode( $order_id ) ); }
	private function razorpay_get( $path ) {
		$key_id = defined( 'CH_RAZORPAY_TEST_KEY_ID' ) ? (string) CH_RAZORPAY_TEST_KEY_ID : (string) getenv( 'CH_RAZORPAY_TEST_KEY_ID' );
		$key_secret = defined( 'CH_RAZORPAY_TEST_KEY_SECRET' ) ? (string) CH_RAZORPAY_TEST_KEY_SECRET : (string) getenv( 'CH_RAZORPAY_TEST_KEY_SECRET' );
		if ( ! preg_match( '/^rzp_test_[A-Za-z0-9]+$/D', $key_id ) || strlen( $key_secret ) < 8 ) { return new WP_Error( 'credentials_unavailable' ); }
		$response = wp_remote_get( 'https://api.razorpay.com/v1/' . $path, array( 'timeout' => 20, 'redirection' => 0, 'headers' => array( 'Authorization' => 'Basic ' . base64_encode( $key_id . ':' . $key_secret ), 'Accept' => 'application/json' ) ) );
		if ( is_wp_error( $response ) || (int) wp_remote_retrieve_response_code( $response ) < 200 || (int) wp_remote_retrieve_response_code( $response ) >= 300 ) { return new WP_Error( 'provider_unavailable' ); }
		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		return is_array( $body ) ? $body : new WP_Error( 'provider_unavailable' );
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
		if ( ! $order || 'ch_razorpay' !== (string) ( $order->gateway ?? '' ) || ! $stored_hash || ! hash_equals( $stored_hash, hash( 'sha256', $token ) ) || ! hash_equals( $stored_order_id, $claimed_order_id ) ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment verification.', 404 ) );
		}
		$user_id = get_current_user_id();
		if ( ! empty( $order->user_id ) && (int) $order->user_id !== (int) $user_id ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment verification.', 404 ) );
		}
		if ( 'sale' !== $order->type || ! in_array( $order->status, array( 'pending', 'complete' ), true ) || 'INR' !== strtoupper( (string) $order->currency ) || 'INR' !== strtoupper( (string) edd_get_currency() ) ) {
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
			$order = edd_get_order( $order_id );
			if ( ! $order || ! in_array( $order->status, array( 'pending', 'complete' ), true ) ) { return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment verification.', 409 ) ); }
			$recorded_payment = (string) edd_get_order_meta( $order_id, 'ch_razorpay_verified_payment_id', true );
			$recorded_status = (string) edd_get_order_meta( $order_id, 'ch_razorpay_verified_payment_status', true );
			if ( '' !== $recorded_payment ) {
				if ( ! hash_equals( $recorded_payment, $payment_id ) ) { return $this->private_response( CH_API::error( 'payment_already_verified', 'A different payment is already recorded for this order.', 409 ) ); }
				if ( 'captured' === $recorded_status ) {
					$transaction = $this->record_captured_transaction( $order_id, $order, $payment_id );
					if ( is_wp_error( $transaction ) ) { return $this->private_response( CH_API::error( 'payment_record_failed', 'Verified payment could not be recorded. Retry shortly.', 503 ) ); }
					if ( 'complete' === $order->status ) { return $this->private_response( CH_API::success( array( 'status' => 'captured', 'verified' => true, 'fulfilled' => true, 'edd_order_reference' => (string) $order->get_number() ) ) ); }
					if ( ! $this->fulfillment_enabled() ) { return $this->private_response( CH_API::success( array( 'status' => 'captured', 'verified' => true, 'fulfilled' => false, 'edd_order_reference' => (string) $order->get_number() ) ) ); }
				}
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
			if ( 'captured' === $payment_status ) {
				$transaction = $this->record_captured_transaction( $order_id, $order, $payment_id );
				if ( is_wp_error( $transaction ) ) { return $this->private_response( CH_API::error( 'payment_record_failed', 'Verified payment could not be recorded. Retry shortly.', 503 ) ); }
			}
			$fulfilled = 'captured' === $payment_status ? $this->fulfill_captured_order( $order_id, $stored_order_id, $payment_id, $amount ) : false;
			if ( is_wp_error( $fulfilled ) ) { return $this->private_response( CH_API::error( 'payment_fulfillment_failed', 'Verified payment could not be recorded as complete. Retry shortly.', 503 ) ); }
			return $this->private_response( CH_API::success( array( 'status' => $payment_status, 'verified' => true, 'fulfilled' => (bool) $fulfilled, 'edd_order_reference' => (string) $order->get_number() ) ) );
		} finally {
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
		}
	}

	public function bridge_permission( $request ) {
		$bridge = $this->auth->bridge_permission( $request );
		if ( true !== $bridge ) { return $bridge; }
		return '' !== (string) $request->get_header( 'authorization' ) ? $this->auth->session_permission( $request ) : true;
	}

	/** Return minimal order state only to the owner holding its scoped payment capability. */
	public function order_status( $request ) {
		$order_id = absint( $request->get_param( 'order_id' ) );
		$token = (string) $request->get_param( 'authorization_token' );
		if ( ! $order_id || ! preg_match( '/^[a-f0-9]{64}$/D', $token ) ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not available.', 404 ) );
		}
		$order = edd_get_order( $order_id );
		$stored_hash = (string) edd_get_order_meta( $order_id, 'ch_payment_authorization_hash', true );
		if ( ! $order || ! $stored_hash || ! hash_equals( $stored_hash, hash( 'sha256', $token ) ) || 'sale' !== $order->type ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not available.', 404 ) );
		}
		$user_id = get_current_user_id();
		if ( ! empty( $order->user_id ) && (int) $order->user_id !== (int) $user_id ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not available.', 404 ) );
		}
		$payment_status = (string) edd_get_order_meta( $order_id, 'ch_razorpay_verified_payment_status', true );
		return $this->private_response( CH_API::success( array(
			'edd_order_reference' => (string) $order->get_number(),
			'order_status' => (string) $order->status,
			'payment_status' => $payment_status,
			'fulfilled' => in_array( (string) $order->status, array( 'complete', 'partially_refunded' ), true ) && 'captured' === $payment_status && '1' !== (string) edd_get_order_meta( $order_id, 'ch_razorpay_full_refund_verified', true ),
			'free_completed' => 'complete' === $order->status && 0.0 === (float) $order->total && 'manual' === (string) $order->gateway && 'zero_total' === (string) edd_get_order_meta( $order_id, 'ch_checkout_type', true ),
		) ) );
	}

	/** List files for a completed order only after validating its HttpOnly-backed capability. */
	public function order_downloads( $request ) {
		$authorized = $this->authorized_completed_order( $request );
		if ( is_wp_error( $authorized ) ) { return $this->private_response( CH_API::error( 'download_order_unavailable', 'Downloads are not available for this order.', 404 ) ); }
		list( $order_id, $order ) = $authorized;
		$items = $this->deliverable_order_items( $order_id );
		if ( false === $items ) { return $this->private_response( CH_API::error( 'download_unavailable', 'Downloads are temporarily unavailable.', 503 ) ); }
		$result = array();
		foreach ( $items as $item ) {
			$product_id = absint( $item->product_id ?? 0 );
			$price_id = isset( $item->price_id ) ? $item->price_id : null;
			$title = sanitize_text_field( html_entity_decode( (string) ( $item->product_name ?? '' ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
			if ( function_exists( 'get_post_status' ) && 'publish' !== get_post_status( $product_id ) ) { continue; }
			if ( function_exists( 'get_the_title' ) && get_the_title( $product_id ) ) { $title = sanitize_text_field( get_the_title( $product_id ) ); }
			$files = $this->entitled_download_files( $product_id, $price_id );
			$public_files = array();
			foreach ( $files as $file_key => $file ) {
				if ( ! is_array( $file ) || empty( $file['file'] ) || ! is_string( $file['file'] ) ) { continue; }
				$file_name = function_exists( 'edd_get_file_name' ) ? edd_get_file_name( $file ) : basename( $file['file'] );
				$public_files[] = array( 'key' => (string) $file_key, 'name' => sanitize_text_field( (string) $file_name ) );
			}
			if ( $public_files ) { $result[] = array( 'order_item_id' => (int) $item->id, 'title' => $title, 'files' => $public_files ); }
		}
		return $this->private_response( CH_API::success( array( 'order' => (string) $order->get_number(), 'items' => $result ) ) );
	}

	/** Mint a fresh native EDD download URL for one entitled order-item file. */
	public function order_download_url( $request ) {
		$authorized = $this->authorized_completed_order( $request );
		if ( is_wp_error( $authorized ) ) { return $this->private_response( CH_API::error( 'download_order_unavailable', 'Downloads are not available for this order.', 404 ) ); }
		list( $order_id, $order ) = $authorized;
		$item_id = absint( $request->get_param( 'order_item_id' ) );
		$file_key = $request->get_param( 'file_key' );
		if ( ! $item_id || ! is_string( $file_key ) || ! preg_match( '/^[A-Za-z0-9_-]{1,80}$/D', $file_key ) || ! function_exists( 'edd_get_order_item' ) || ! function_exists( 'edd_get_download_file_url' ) ) {
			return $this->private_response( CH_API::error( 'download_unavailable', 'This download is not available.', 404 ) );
		}
		$item = edd_get_order_item( $item_id );
		if ( ! $item || (int) $item->order_id !== $order_id || ! in_array( (string) ( $item->status ?? '' ), $this->deliverable_item_statuses(), true ) ) {
			return $this->private_response( CH_API::error( 'download_unavailable', 'This download is not available.', 404 ) );
		}
		$files = $this->entitled_download_files( (int) $item->product_id, $item->price_id ?? null );
		if ( ! array_key_exists( $file_key, $files ) || ! is_array( $files[ $file_key ] ) || empty( $files[ $file_key ]['file'] ) ) {
			return $this->private_response( CH_API::error( 'download_unavailable', 'This download is not available.', 404 ) );
		}
		$url = edd_get_download_file_url( $item, (string) $order->email, $file_key );
		if ( ! is_string( $url ) || '' === $url ) { return $this->private_response( CH_API::error( 'download_unavailable', 'This download is temporarily unavailable.', 503 ) ); }
		return $this->private_response( CH_API::success( array( 'url' => esc_url_raw( $url ) ) ) );
	}

	/** Return an order only when this request proves capability, ownership and complete eligible status. */
	private function authorized_completed_order( $request ) {
		$order_id = absint( $request->get_param( 'order_id' ) );
		$token = (string) $request->get_param( 'authorization_token' );
		if ( ! $order_id || ! preg_match( '/^[a-f0-9]{64}$/D', $token ) ) { return new WP_Error( 'unauthorized' ); }
		$order = edd_get_order( $order_id );
		$stored_hash = (string) edd_get_order_meta( $order_id, 'ch_payment_authorization_hash', true );
		if ( ! $order || 'sale' !== $order->type || ! in_array( (string) $order->status, array( 'complete', 'partially_refunded' ), true ) || ! $stored_hash || ! hash_equals( $stored_hash, hash( 'sha256', $token ) ) ) { return new WP_Error( 'unauthorized' ); }
		$active_token = function_exists( 'get_transient' ) ? (string) get_transient( 'ch_pay_auth_' . $order_id ) : '';
		if ( '' === $active_token || ! hash_equals( $active_token, $token ) ) { return new WP_Error( 'unauthorized' ); }
		$user_id = get_current_user_id();
		if ( ! empty( $order->user_id ) && (int) $order->user_id !== (int) $user_id ) { return new WP_Error( 'unauthorized' ); }
		$gateway = (string) ( $order->gateway ?? '' );
		$is_custom_gateway = in_array( $gateway, array( 'ch_razorpay', '' ), true );
		$is_paid_custom_order = $is_custom_gateway && $this->has_verified_custom_payment_association( $order_id, $order );
		$is_free_order = 'manual' === (string) ( $order->gateway ?? '' ) && 0.0 === (float) $order->total && 'zero_total' === (string) edd_get_order_meta( $order_id, 'ch_checkout_type', true );
		if ( ! $is_paid_custom_order && ! $is_free_order ) { return new WP_Error( 'unauthorized' ); }
		if ( $is_paid_custom_order && ( '1' === (string) edd_get_order_meta( $order_id, 'ch_razorpay_full_refund_verified', true ) || 'refunded' === $order->status ) ) { return new WP_Error( 'unauthorized' ); }
		return array( $order_id, $order );
	}

	private function deliverable_item_statuses() {
		return function_exists( 'edd_get_deliverable_order_item_statuses' ) ? edd_get_deliverable_order_item_statuses() : array( 'complete', 'partially_refunded' );
	}

	/** Validate only previously persisted, server-verified custom payment evidence; never contact the provider here. */
	private function has_verified_custom_payment_association( $order_id, $order ) {
		if ( ! $order || 'sale' !== (string) $order->type || 'INR' !== strtoupper( (string) $order->currency ) ) { return false; }
		$razorpay_order_id = (string) edd_get_order_meta( $order_id, 'ch_razorpay_order_id', true );
		$payment_id = (string) edd_get_order_meta( $order_id, 'ch_razorpay_verified_payment_id', true );
		$payment_status = (string) edd_get_order_meta( $order_id, 'ch_razorpay_verified_payment_status', true );
		$verified_at = (string) edd_get_order_meta( $order_id, 'ch_razorpay_verified_at', true );
		$amount_paise = $this->to_paise( $order->total );
		$stored_amount = edd_get_order_meta( $order_id, 'ch_razorpay_amount_paise', true );
		return preg_match( '/^order_[A-Za-z0-9]+$/D', $razorpay_order_id )
			&& preg_match( '/^pay_[A-Za-z0-9]+$/D', $payment_id )
			&& 'captured' === $payment_status
			&& '' !== $verified_at
			&& false !== strtotime( $verified_at )
			&& false !== $amount_paise && $amount_paise > 0
			&& is_numeric( $stored_amount ) && (int) $stored_amount === $amount_paise;
	}

	private function deliverable_order_items( $order_id ) {
		if ( ! function_exists( 'edd_get_order_items' ) ) { return false; }
		return edd_get_order_items( array( 'order_id' => $order_id, 'status__in' => $this->deliverable_item_statuses(), 'number' => 500, 'no_found_rows' => true ) );
	}

	private function entitled_download_files( $product_id, $price_id ) {
		if ( class_exists( 'EDD\\Downloads\\Entitlement' ) ) { return ( new \EDD\Downloads\Entitlement( $product_id, $price_id ) )->get_files(); }
		$download = function_exists( 'edd_get_download' ) ? edd_get_download( $product_id ) : false;
		return $download && method_exists( $download, 'get_files_for_price_id' ) ? (array) $download->get_files_for_price_id( $price_id ) : array();
	}

	public function create_order( $request ) {
		$order_id = absint( $request->get_param( 'order_id' ) );
		$token = (string) $request->get_param( 'authorization_token' );
		if ( ! $order_id || ! preg_match( '/^[a-f0-9]{64}$/D', $token ) || ! function_exists( 'edd_get_order' ) || ! function_exists( 'edd_get_order_meta' ) ) {
			return $this->private_response( CH_API::error( 'payment_order_ineligible', 'This order is not eligible for payment.', 404 ) );
		}
		$order = edd_get_order( $order_id );
		$stored_hash = (string) edd_get_order_meta( $order_id, 'ch_payment_authorization_hash', true );
		if ( ! $order || 'ch_razorpay' !== (string) ( $order->gateway ?? '' ) || ! $stored_hash || ! hash_equals( $stored_hash, hash( 'sha256', $token ) ) ) {
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

	/** Complete only an independently verified, captured custom-integration order. Caller holds ch_rzpv_<order>. */
	private function fulfill_captured_order( $order_id, $razorpay_order_id, $payment_id, $amount ) {
		if ( ! $this->fulfillment_enabled() ) { return false; }
		if ( (int) edd_get_order_meta( $order_id, 'ch_razorpay_refunded_amount_paise', true ) > 0 || '1' === (string) edd_get_order_meta( $order_id, 'ch_razorpay_full_refund_verified', true ) ) { return false; }
		$order = edd_get_order( $order_id );
		if ( ! $order || 'sale' !== $order->type || ! in_array( $order->status, array( 'pending', 'complete' ), true ) || 'INR' !== strtoupper( (string) $order->currency ) ) { return new WP_Error( 'order_ineligible' ); }
		$stored_order_id = (string) edd_get_order_meta( $order_id, 'ch_razorpay_order_id', true );
		$stored_payment_id = (string) edd_get_order_meta( $order_id, 'ch_razorpay_verified_payment_id', true );
		$stored_amount = (int) edd_get_order_meta( $order_id, 'ch_razorpay_amount_paise', true );
		if ( ! $this->has_verified_custom_payment_association( $order_id, $order ) || ! hash_equals( $stored_order_id, (string) $razorpay_order_id ) || ! hash_equals( $stored_payment_id, (string) $payment_id ) || $stored_amount !== (int) $amount ) { return new WP_Error( 'payment_mismatch' ); }
		if ( 'complete' === $order->status ) { return true; }
		if ( ! function_exists( 'edd_update_order_status' ) ) { return new WP_Error( 'edd_unavailable' ); }
		edd_update_order_status( $order_id, 'complete' );
		$updated = edd_get_order( $order_id );
		if ( ! $updated || 'complete' !== $updated->status ) { return new WP_Error( 'completion_failed' ); }
		$this->persist_order_meta( $order_id, 'ch_razorpay_fulfilled_at', gmdate( 'c' ) );
		return true;
	}

	/** Insert the captured payment once using EDD 3.x order transaction APIs. Caller holds ch_rzpv_<order>. */
	private function record_captured_transaction( $order_id, $order, $payment_id ) {
		if ( 'ch_razorpay' !== (string) ( $order->gateway ?? '' ) ) { return new WP_Error( 'edd_transaction_gateway_mismatch' ); }
		if ( ! function_exists( 'edd_get_order_transaction_by' ) || ! function_exists( 'edd_add_order_transaction' ) ) { return new WP_Error( 'edd_transaction_unavailable' ); }
		global $wpdb;
		$lock_name = 'ch_rzpt_' . substr( hash( 'sha256', (string) $payment_id ), 0, 56 );
		if ( '1' !== (string) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 5)', $lock_name ) ) ) { return new WP_Error( 'edd_transaction_busy' ); }
		try {
			$existing = edd_get_order_transaction_by( 'transaction_id', $payment_id );
			if ( $existing ) {
				$valid = (int) ( $existing->object_id ?? 0 ) === (int) $order_id
					&& 'order' === (string) ( $existing->object_type ?? '' )
					&& 'ch_razorpay' === (string) ( $existing->gateway ?? '' )
					&& 'complete' === (string) ( $existing->status ?? '' )
					&& abs( (float) ( $existing->total ?? 0 ) - (float) $order->total ) < 0.00001;
				return $valid ? true : new WP_Error( 'edd_transaction_conflict' );
			}
			$result = edd_add_order_transaction( array(
				'object_type' => 'order', 'object_id' => (int) $order_id,
				'transaction_id' => (string) $payment_id, 'gateway' => 'ch_razorpay',
				'status' => 'complete', 'total' => (float) $order->total,
			) );
			$stored = edd_get_order_transaction_by( 'transaction_id', $payment_id );
			if ( $stored && (int) ( $stored->object_id ?? 0 ) === (int) $order_id && 'order' === (string) ( $stored->object_type ?? '' ) && 'ch_razorpay' === (string) ( $stored->gateway ?? '' ) && 'complete' === (string) ( $stored->status ?? '' ) && abs( (float) ( $stored->total ?? 0 ) - (float) $order->total ) < 0.00001 ) { return true; }
			return $result ? new WP_Error( 'edd_transaction_conflict' ) : new WP_Error( 'edd_transaction_write_failed' );
		} finally {
			$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
		}
	}

	/** Opt-in only; absent configuration is deliberately disabled. */
	private function fulfillment_enabled() {
		$value = defined( 'CH_RAZORPAY_AUTO_FULFILL' ) ? constant( 'CH_RAZORPAY_AUTO_FULFILL' ) : getenv( 'CH_RAZORPAY_AUTO_FULFILL' );
		return true === $value || '1' === (string) $value;
	}

	/** Store scalar EDD order metadata and confirm it, including when an API reports a no-op update as false. */
	private function persist_order_meta( $order_id, $key, $value ) {
		$current = edd_get_order_meta( $order_id, $key, true );
		if ( $this->meta_values_equal( $current, $value ) ) { return true; }
		edd_update_order_meta( $order_id, $key, $value );
		return $this->meta_values_equal( edd_get_order_meta( $order_id, $key, true ), $value );
	}

	private function meta_values_equal( $left, $right ) {
		if ( is_array( $left ) || is_object( $left ) || is_array( $right ) || is_object( $right ) ) { return serialize( $left ) === serialize( $right ); }
		return (string) $left === (string) $right;
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
