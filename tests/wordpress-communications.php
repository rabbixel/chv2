<?php
/** Isolated receipt content tests. No WordPress, database or SMTP required. */
define( 'ABSPATH', __DIR__ );
$GLOBALS['hooks'] = array(); $GLOBALS['origin'] = 'https://shop.example.test'; $GLOBALS['environment'] = 'production';
function add_filter( $name, $callback, $priority = 10, $count = 1 ) { $GLOBALS['hooks'][] = $name; }
function apply_filters( $name, $value ) { return 'ch_communications_frontend_url' === $name ? $GLOBALS['origin'] : $value; }
function home_url( $path ) { return 'https://shop.example.test'; }
function wp_parse_url( $url ) { return parse_url( $url ); }
function wp_get_environment_type() { return $GLOBALS['environment']; }
function esc_html( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES, 'UTF-8' ); }
function esc_url( $value ) { return esc_html( $value ); }
function sanitize_text_field( $value ) { return strip_tags( $value ); }
function wp_strip_all_tags( $value ) { return strip_tags( $value ); }
function edd_format_amount( $amount ) { return number_format( $amount, 2 ); }
function edd_currency_filter( $value, $currency ) { return $currency . ' ' . $value; }
function edd_get_payment_gateways() { return array(); }
class FixtureOrder {
    public $id = 123; public $type = 'sale'; public $status = 'complete'; public $email = 'buyer@example.test';
    public $user_id = 0; public $currency = 'INR'; public $gateway = 'ch_razorpay';
    public $date_created = '2026-10-28 09:00:00'; public $subtotal = 49; public $tax = 0; public $discount = 0; public $total = 49;
    public function get_number() { return 'CH-123'; }
    public function get_items() { return array( (object) array( 'product_name' => 'Portrait &amp; Bundle — Trial Version <script>x</script>', 'quantity' => 1, 'amount' => 49, 'total' => 49 ) ); }
    public function get_address() { return (object) array( 'name' => '<Buyer>' ); }
}
function check( $condition, $message ) { if ( ! $condition ) { throw new RuntimeException( $message ); } ++$GLOBALS['assertions']; }
$GLOBALS['assertions'] = 0;
require __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-communications.php';
$communications = new CH_Communications(); $communications->register_hooks();
check( ! in_array( 'edd_complete_purchase', $GLOBALS['hooks'], true ) && ! in_array( 'edd_after_order_actions', $GLOBALS['hooks'], true ), 'presentation hooks must not add a second email sender' );
$order = new FixtureOrder();
$body = $communications->receipt_body( 'old', $order );
check( strpos( $body, 'Order CH-123' ) !== false && strpos( $body, '2026-10-28' ) !== false, 'receipt identifies order/date' );
check( strpos( $body, 'Portrait &amp; Bundle — Trial Version &lt;script&gt;' ) !== false && strpos( $body, '&lt;Buyer&gt;' ) !== false, 'snapshot and customer content escaped' );
check( strpos( $body, 'Subtotal: INR 49.00' ) !== false && strpos( $body, 'Total: INR 49.00' ) !== false, 'order totals retained' );
check( strpos( $body, 'Payment received. Payment method: Razorpay.' ) !== false, 'paid completion accurately described' );
check( strpos( $body, '/claim-account' ) !== false && strpos( $body, '/account/orders/' ) === false, 'guest receives verification-based recovery without mandatory purchase registration' );
check( ! preg_match( '/eddfile=|token=|payment_key|license_key|AWSAccessKeyId|X-Amz-/', $body ), 'no delivery tokens or activation keys in receipt' );
$order->user_id = 55;
$member = $communications->receipt_body( '', $order );
check( strpos( $member, '/account/orders/123/receipt' ) !== false && strpos( $member, '/account/downloads' ) !== false, 'member receives account-scoped receipt/download routes' );
$order->total = 0; $order->subtotal = 0;
check( strpos( $communications->receipt_body( '', $order ), 'No payment was required' ) !== false, 'free order does not claim paid payment' );
$order->status = 'refunded';
check( strpos( $communications->receipt_body( '', $order ), '/account/downloads' ) === false, 'refunded receipt does not advertise file access' );
foreach ( array( 'pending', 'failed', 'revoked', 'abandoned' ) as $status ) {
    $order->status = $status;
    $email = new class( $order ) { private $order; public function __construct( $order ) { $this->order = $order; } public function get_order() { return $this->order; } };
    check( $communications->disable_uncompleted_receipt( false, $email ), 'uncompleted/revoked orders cannot send a purchase receipt' );
}
$order->status = 'complete';
check( $communications->disable_uncompleted_receipt( true, $email ), 'existing receipt disablement preserved' );
check( ! $communications->disable_uncompleted_receipt( false, $email ), 'eligible receipt allowed' );
foreach ( array( 'https://user@shop.example.test', 'https://shop.example.test?token=bad', 'http://shop.example.test', 'https://shop.example.test/path' ) as $origin ) {
    $GLOBALS['origin'] = $origin;
    check( strpos( $communications->receipt_body( '', $order ), '<a href=' ) === false, 'unsafe storefront origin rejected' );
}
echo 'PASS: ' . $GLOBALS['assertions'] . " receipt communication assertions\n";
