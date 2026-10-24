<?php
/** Synthetic purchase-limit, reservation and completion-lock tests. */
define( 'ABSPATH', __DIR__ );
class WP_Error { public $code; public function __construct( $code, $message = '' ) { $this->code = $code; } }
class FakeLimitDb {
	public $prefix = 'wp_'; public $busy = false; public $locks = array(); public $last_query = ''; public $last_args = array(); public $gross_query = ''; public $gross_args = array();
	public function prepare( $sql, ...$args ) { if ( 1 === count( $args ) && is_array( $args[0] ) ) { $args = $args[0]; } return array( $sql, $args ); }
	public function get_var( $query ) {
		$sql = $query[0]; $args = $query[1] ?? array(); $this->last_query = $sql; $this->last_args = $args;
		if ( false !== strpos( $sql, 'GET_LOCK' ) ) { $name = $args[0]; if ( $this->busy || isset( $this->locks[ $name ] ) ) { return '0'; } $this->locks[ $name ] = true; return '1'; }
		if ( false !== strpos( $sql, 'RELEASE_LOCK' ) ) { unset( $this->locks[ $args[0] ] ); return '1'; }
		if ( false !== strpos( $sql, 'COALESCE(SUM(oi.quantity)' ) ) { $this->gross_query = $sql; $this->gross_args = $args; return $GLOBALS['sales'][ (int) $args[1] ] ?? 0; }
		if ( false !== strpos( $sql, 'COALESCE(SUM(i.quantity)' ) ) {
			$product_id = (int) $args[0]; $exclude_id = (int) $args[1]; $total = 0;
			foreach ( $GLOBALS['reservations'] as $reservation ) {
				$terminal = in_array( $reservation['status'], array( 'complete', 'completed', 'publish', 'partially_refunded', 'refunded' ), true );
				if ( $product_id !== (int) $reservation['product_id'] || $exclude_id === (int) $reservation['order_id'] || $terminal ) { continue; }
				$expired = ! empty( $reservation['expires'] ) && $reservation['expires'] <= time();
				$has_provider = ! empty( $reservation['provider_order'] );
				$protected_state = in_array( $reservation['state'] ?? '', array( 'creating', 'uncertain', 'created' ), true );
				if ( $expired && ! $has_provider && ! $protected_state ) { continue; }
				$total += (int) $reservation['quantity'];
			}
			return $total;
		}
		return '1';
	}
}
class LimitOrder { public $id; public $type = 'sale'; public $status = 'pending'; public function __construct( $id ) { $this->id = $id; } }
$GLOBALS['wpdb'] = new FakeLimitDb();
function get_post_meta( $id, $key, $single = true ) { if ( '_edd_purchase_limit' === $key ) { return $GLOBALS['limits'][ $id ] ?? ''; } if ( '_edd_download_sales' === $key ) { return $GLOBALS['sales_meta'][ $id ] ?? (string) ( $GLOBALS['sales'][ $id ] ?? 0 ); } return ''; }
function edd_get_download_sales_stats( $id ) { $GLOBALS['sales_api_calls'] = ( $GLOBALS['sales_api_calls'] ?? 0 ) + 1; return $GLOBALS['sales'][ $id ] ?? 0; }
function edd_get_gross_order_statuses() { return array( 'complete', 'refunded', 'partially_refunded', 'revoked', 'on_hold' ); }
function get_current_blog_id() { return 1; }
function absint( $value ) { return abs( (int) $value ); }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function add_action( ...$args ) {}
function add_filter( ...$args ) {}
function edd_get_cart_contents() { return $GLOBALS['cart']; }
function edd_item_quantities_enabled() { return true; }
function edd_set_error( $code, $message ) { $GLOBALS['edd_errors'][] = $code; }
function edd_get_order( $id ) { return $GLOBALS['orders'][ $id ] ?? false; }
function edd_get_order_items( $args ) { return array_values( array_filter( $GLOBALS['order_items'], static function ( $item ) use ( $args ) { return (int) $item->order_id === (int) $args['order_id']; } ) ); }
require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-purchase-limit-service.php';
$passed = 0; $failed = 0;
function check_limit( $ok, $label ) { global $passed, $failed; if ( $ok ) { $passed++; } else { $failed++; fwrite( STDERR, "FAIL: {$label}\n" ); } }
function fixture_limits() { $GLOBALS['limits'] = array( 1 => '', 2 => '0', 3 => '1', 4 => '-1', 5 => '-2', 6 => '2' ); $GLOBALS['sales'] = array( 3 => 0, 4 => 0, 5 => 0, 6 => 1 ); $GLOBALS['sales_meta'] = array(); $GLOBALS['sales_api_calls'] = 0; $GLOBALS['reservations'] = array(); $GLOBALS['cart'] = array(); $GLOBALS['edd_errors'] = array(); $GLOBALS['orders'] = array(); $GLOBALS['order_items'] = array(); $GLOBALS['wpdb'] = new FakeLimitDb(); }
fixture_limits(); $service = new CH_Purchase_Limit_Service();
check_limit( 0 === $service->get_limit( 1 ) && 0 === $service->get_limit( 2 ) && true === $service->availability( 1 )['available'], 'missing, blank and zero limits are unlimited' );
check_limit( true === $service->availability( 3 )['available'] && 1 === $service->availability( 3 )['remaining'] && false !== strpos( $GLOBALS['wpdb']->last_query, 'edd_order_id' ) && in_array( 'refunded', $GLOBALS['wpdb']->gross_args, true ), 'limit-one product uses EDD gross statuses and order-meta schema' );
$GLOBALS['sales'][3] = 1; check_limit( false === $service->availability( 3 )['available'] && true === $service->availability( 3 )['sold_out'], 'completed sale exhausts a limit-one product' );
check_limit( false === $service->availability( 4 )['available'] && true === $service->availability( 4 )['sold_out'], '-1 sentinel remains permanently sold out' );
check_limit( false === $service->availability( 5 )['available'], 'invalid negative metadata fails closed' );
$GLOBALS['sales_meta'][11] = ''; $GLOBALS['limits'][11] = '1'; $calls_before_missing_counter = $GLOBALS['sales_api_calls']; check_limit( true === $service->availability( 11 )['available'] && $calls_before_missing_counter === $GLOBALS['sales_api_calls'], 'missing legacy counter does not affect gross order-item availability' );
$GLOBALS['limits'][6] = '1'; $GLOBALS['sales'][6] = 0; $GLOBALS['reservations'][] = array( 'order_id' => 10, 'product_id' => 6, 'quantity' => 1, 'status' => 'pending', 'gateway' => 'ch_razorpay' );
check_limit( false === $service->availability( 6 )['available'], 'pending order item is a durable reservation' );
$GLOBALS['reservations'][0]['status'] = 'failed'; check_limit( false === $service->availability( 6 )['available'], 'failed status does not release a potentially payable reservation' );
$GLOBALS['reservations'][0]['status'] = 'pending'; $GLOBALS['reservations'][0]['expires'] = time() - 1; $GLOBALS['reservations'][0]['state'] = 'rejected';
check_limit( true === $service->availability( 6 )['available'] && false !== strpos( $GLOBALS['wpdb']->last_query, "ch_purchase_limit_reservation_expires_at" ), 'expired reservation releases only when no provider order can still succeed' );
$GLOBALS['reservations'][0]['state'] = 'uncertain'; check_limit( false === $service->availability( 6 )['available'], 'uncertain provider creation remains reserved after nominal expiry' );
$GLOBALS['reservations'][0]['provider_order'] = 'order_test'; $GLOBALS['reservations'][0]['state'] = 'created'; check_limit( false === $service->availability( 6 )['available'], 'existing provider order remains reserved after expiry' );
$GLOBALS['reservations'][0]['provider_order'] = ''; $GLOBALS['reservations'][0]['state'] = ''; $GLOBALS['reservations'][0]['gateway'] = 'manual'; check_limit( true === $service->availability( 6 )['available'], 'expired zero-total reservation releases after its retry capability can no longer complete it' );
$GLOBALS['limits'][6] = '2'; $GLOBALS['sales'][6] = 2; check_limit( false === $service->availability( 6 )['available'], 'price variations share the site-wide product limit' );
$GLOBALS['reservations'] = array(); $GLOBALS['sales'][6] = 2; check_limit( false === $service->availability( 6 )['available'], 'partial refund retains the EDD completed-sale count' );
$GLOBALS['sales'][6] = 2; check_limit( false === $service->availability( 6 )['available'] && in_array( 'refunded', $GLOBALS['wpdb']->gross_args, true ), 'full refunds remain counted through EDD gross order-item statuses' );

fixture_limits(); $service = new CH_Purchase_Limit_Service(); $GLOBALS['limits'][7] = '1'; $GLOBALS['sales'][7] = 0;
check_limit( true === $service->acquire_for_products( array( 7 ) ) && true === $service->availability( 7 )['available'], 'first buyer locks and validates the last available unit' );
$GLOBALS['reservations'][] = array( 'order_id' => 70, 'product_id' => 7, 'quantity' => 1, 'status' => 'pending', 'gateway' => 'ch_razorpay' );
CH_Purchase_Limit_Service::release_all_locks(); $second = new CH_Purchase_Limit_Service();
check_limit( true === $second->acquire_for_products( array( 7 ) ) && false === $second->availability( 7 )['available'], 'second concurrent buyer sees committed reservation and cannot oversell' );
CH_Purchase_Limit_Service::release_all_locks(); $GLOBALS['wpdb']->busy = true; check_limit( is_wp_error( $second->acquire_for_products( array( 7 ) ) ), 'lock contention fails closed' ); $GLOBALS['wpdb']->busy = false;

fixture_limits(); $service = new CH_Purchase_Limit_Service(); $GLOBALS['limits'][8] = '1'; $GLOBALS['sales'][8] = 0; $GLOBALS['cart'] = array( array( 'id' => 8, 'quantity' => 1 ) );
$service->validate_native_cart(); check_limit( empty( $GLOBALS['edd_errors'] ), 'native EDD checkout validates and locks available limited item' );
$GLOBALS['cart'] = array( array( 'id' => 8, 'quantity' => 2 ) ); $service->validate_native_cart(); check_limit( ! empty( $GLOBALS['edd_errors'] ), 'native EDD checkout rejects over-limit quantity' );
CH_Purchase_Limit_Service::release_all_locks();

fixture_limits(); $service = new CH_Purchase_Limit_Service(); $GLOBALS['limits'][9] = '1'; $GLOBALS['sales'][9] = 0; $GLOBALS['orders'] = array( 90 => new LimitOrder( 90 ), 91 => new LimitOrder( 91 ) ); $GLOBALS['order_items'] = array( (object) array( 'order_id' => 90, 'product_id' => 9, 'quantity' => 1 ), (object) array( 'order_id' => 91, 'product_id' => 9, 'quantity' => 1 ) );
check_limit( true === $service->guard_status_transition( true, 90, 'complete', 'pending' ), 'one reserved final-copy order can complete under product lock' );
$GLOBALS['orders'][90]->status = 'complete'; $GLOBALS['sales'][9] = 1;
check_limit( false === $service->guard_status_transition( true, 91, 'complete', 'pending' ), 'second order cannot complete after first consumes final copy' );
CH_Purchase_Limit_Service::release_all_locks();

if ( $failed ) { exit( 1 ); }
echo "Purchase-limit service tests: {$passed} passed, {$failed} failed.\n";
