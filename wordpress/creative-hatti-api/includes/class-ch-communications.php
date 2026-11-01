<?php
/** Customer receipt presentation only. Native EDD remains the sole sender. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class CH_Communications {
	public function register_hooks() {
		add_filter( 'edd_order_receipt', array( $this, 'receipt_body' ), 100, 2 );
		add_filter( 'edd_order_receipt_email_subject', array( $this, 'receipt_subject' ), 100, 2 );
		add_filter( 'edd_order_receipt_email_heading', array( $this, 'receipt_heading' ), 100, 2 );
		add_filter( 'edd_order_receipt_from_name', array( $this, 'from_name' ) );
		add_filter( 'edd_disable_order_receipt', array( $this, 'disable_uncompleted_receipt' ), 100, 2 );
	}
	public function disable_uncompleted_receipt( $disabled, $email ) {
		$order = $email->get_order();
		return $disabled || ( $order && ( 'sale' !== $order->type || ! in_array( (string) $order->status, array( 'complete', 'partially_refunded', 'refunded' ), true ) ) );
	}

	public function from_name( $name ) { return 'Creative Hatti'; }
	public function receipt_subject( $subject, $order ) {
		return 'Creative Hatti purchase receipt — Order ' . sanitize_text_field( (string) $order->get_number() );
	}
	public function receipt_heading( $heading, $order ) { return 'Your Creative Hatti purchase receipt'; }

	/** No payment keys, activation keys, signed download tokens or storage paths. */
	public function receipt_body( $body, $order ) {
		if ( ! $order || 'sale' !== $order->type ) { return $body; }
		$items = $order->get_items();
		$currency = (string) $order->currency;
		$number = esc_html( (string) $order->get_number() );
		$status = (string) $order->status;
		$completed = in_array( $status, array( 'complete', 'partially_refunded' ), true );
		$address = $order->get_address();
		$name = $address ? trim( (string) ( $address->name ?? '' ) ) : '';
		if ( '' === $name && $address ) { $name = trim( (string) ( $address->first_name ?? '' ) . ' ' . (string) ( $address->last_name ?? '' ) ); }
		$html = '<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;line-height:1.6">';
		$html .= '<p>Thank you for choosing Creative Hatti.</p><h2>Purchase receipt</h2>';
		$html .= '<p><strong>Order ' . $number . '</strong><br>Date: ' . esc_html( (string) $order->date_created ) . '<br>Status: ' . esc_html( str_replace( '_', ' ', $status ) ) . '</p>';
		$html .= '<p>Customer: ' . esc_html( $name ?: 'Customer' ) . '<br>' . esc_html( (string) $order->email ) . '</p>';
		$html .= '<table role="table" style="width:100%;border-collapse:collapse"><thead><tr><th align="left">Product</th><th>Qty</th><th align="right">Unit price</th><th align="right">Amount</th></tr></thead><tbody>';
		foreach ( (array) $items as $item ) {
			// product_name is the purchase-time snapshot, including an option label
			// when EDD stored one. Never substitute current license assignments.
			$html .= '<tr><td style="padding:8px 0;overflow-wrap:anywhere">' . esc_html( html_entity_decode( (string) $item->product_name, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) ) . '</td><td align="center">' . (int) $item->quantity . '</td><td align="right">' . $this->money( $item->amount, $currency ) . '</td><td align="right">' . $this->money( $item->total, $currency ) . '</td></tr>';
		}
		$html .= '</tbody></table><p>Subtotal: ' . $this->money( $order->subtotal, $currency ) . '<br>Discount: ' . $this->money( $order->discount, $currency ) . '<br>Tax: ' . $this->money( $order->tax, $currency ) . '<br><strong>Total: ' . $this->money( $order->total, $currency ) . '</strong></p>';
		if ( 0.0 === (float) $order->total ) {
			$html .= '<p>No payment was required for this order.</p>';
		} else {
			$gateways = edd_get_payment_gateways();
			$method = $gateways[ $order->gateway ]['checkout_label'] ?? ( 'ch_razorpay' === $order->gateway ? 'Razorpay' : '' );
			$html .= '<p>' . ( $completed ? 'Payment received.' : 'This receipt does not confirm current download access.' ) . ( $method ? ' Payment method: ' . esc_html( $method ) . '.' : '' ) . '</p>';
		}
		$configured_frontend = defined( 'CH_FRONTEND_URL' ) ? CH_FRONTEND_URL : home_url( '/' );
		$origin = rtrim( (string) apply_filters( 'ch_communications_frontend_url', $configured_frontend ), '/' );
		$parts = wp_parse_url( $origin );
		$valid_origin = is_array( $parts ) && in_array( $parts['scheme'] ?? '', array( 'http', 'https' ), true ) && ! empty( $parts['host'] ) &&
			! isset( $parts['user'] ) && ! isset( $parts['pass'] ) && ! isset( $parts['query'] ) && ! isset( $parts['fragment'] ) && empty( $parts['path'] ) &&
			( 'production' !== wp_get_environment_type() || 'https' === $parts['scheme'] );
		if ( $valid_origin ) {
			if ( ! empty( $order->user_id ) ) {
				$html .= '<p><a href="' . esc_url( $origin . '/account/orders/' . (int) $order->id . '/receipt' ) . '">View your receipt</a>';
				if ( $completed ) { $html .= ' · <a href="' . esc_url( $origin . '/account/downloads' ) . '">Access your purchased downloads</a>'; }
				$html .= '</p>';
			} elseif ( $completed ) {
				$html .= '<p>To download your files, return to the browser where you placed your order. You can also <a href="' . esc_url( $origin . '/claim-account' ) . '">recover your purchase by verifying your email</a>. Your receipt is included above; registration was not required to purchase.</p>';
			}
			$html .= '<p>Design usage rights follow the terms supplied with the product and your purchased option. Software activation records are separate from design usage rights. If the applicable terms are unclear, <a href="' . esc_url( $origin . '/contact' ) . '">contact us</a> with your order number.</p>';
		}
		return $html . '<p>This is a purchase receipt, not a GST tax invoice.</p></div>';
	}

	private function money( $amount, $currency ) {
		return esc_html( html_entity_decode( wp_strip_all_tags( edd_currency_filter( edd_format_amount( $amount ), $currency ) ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
	}
}
