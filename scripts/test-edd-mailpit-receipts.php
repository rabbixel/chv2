<?php
/** Native EDD email pipeline with in-memory orders and rollback-only email logs.
 * Requires scripts/start-local-mailpit.ps1 on localhost:11025 / 18025.
 * No real orders, customers, licenses, completion hooks or payment calls.
 */
if ( PHP_SAPI !== 'cli' ) { exit( 1 ); }
define( 'DISABLE_WP_CRON', true );
$_SERVER['REQUEST_SCHEME'] = 'http'; $_SERVER['HTTP_HOST'] = 'creativehatti.test';
require ( $argv[1] ?? 'C:/laragon/www/creativehatti' ) . '/wp-load.php';
if ( 'local' !== wp_get_environment_type() || 'creativehatti.test' !== wp_parse_url( home_url(), PHP_URL_HOST ) ) {
    fwrite( STDERR, "Refusing non-local WordPress.\n" ); exit( 1 );
}
require_once __DIR__ . '/../wordpress/creative-hatti-api/includes/class-ch-communications.php';
( new CH_Communications() )->register_hooks();
add_filter( 'ch_communications_frontend_url', static function () { return 'http://localhost:3000'; } );

// Fail closed even if another installed mail plugin has configuration.
add_action( 'phpmailer_init', static function ( $mailer ) {
    foreach ( array_keys( $mailer->getAllRecipientAddresses() ) as $recipient ) {
        if ( ! preg_match( '/@example\.test$/D', $recipient ) ) { throw new RuntimeException( 'Non-synthetic mail recipient blocked.' ); }
    }
    $mailer->isSMTP(); $mailer->Host = '127.0.0.1'; $mailer->Port = 11025;
    $mailer->SMTPAuth = false; $mailer->SMTPSecure = ''; $mailer->SMTPAutoTLS = false;
    $mailer->setFrom( 'receipts@example.test', 'Creative Hatti' );
    $mailer->clearReplyTos(); $mailer->addReplyTo( 'receipts@example.test' );
}, PHP_INT_MAX );

class CH_Email_Fixture_Order extends EDD\Orders\Order {
    public function __construct( $id, $total, $member, $status = 'complete' ) {
        $this->id = $id; $this->type = 'sale'; $this->status = $status; $this->total = $total;
        $this->subtotal = $total; $this->discount = 0; $this->tax = 0;
        $this->user_id = $member ? 987654321 : 0; $this->customer_id = 987654321;
        $this->email = ( $member ? 'member' : 'guest' ) . '-' . $id . '@example.test';
        $this->currency = 'INR'; $this->gateway = $total ? 'ch_razorpay' : 'manual';
        $this->date_created = '2026-10-28 09:00:00';
    }
    public function get_number() { return 'MAILTEST-' . $this->id; }
    public function get_items() {
        return array( (object) array( 'product_name' => 'Synthetic portrait — Trial Version (2 Characters)', 'quantity' => 1, 'amount' => $this->total, 'total' => $this->total ) );
    }
    public function get_address() { return (object) array( 'name' => 'Synthetic Buyer' ); }
}

function email_check( $condition, $message ) { if ( ! $condition ) { throw new RuntimeException( $message ); } }
function mailpit_messages() {
    $response = wp_remote_get( 'http://127.0.0.1:18025/api/v1/messages', array( 'timeout' => 5 ) );
    if ( is_wp_error( $response ) ) { throw new RuntimeException( 'Local Mailpit is not reachable.' ); }
    return json_decode( wp_remote_retrieve_body( $response ), true );
}
$initial = mailpit_messages();
email_check( isset( $initial['total'] ), 'Mailpit response invalid.' );
$flags = array();
add_filter( 'get_edd_order_metadata', static function ( $value, $id, $key ) use ( &$flags ) {
    if ( $id >= 987650000 ) { return $flags[$id][$key] ?? false; }
    return $value;
}, 10, 3 );
add_filter( 'delete_edd_order_metadata', static function ( $value, $id, $key ) use ( &$flags ) {
    if ( $id >= 987650000 ) { unset( $flags[$id][$key] ); return true; }
    return $value;
}, 10, 3 );
global $wpdb;
$wpdb->query( 'START TRANSACTION' );
try {
    $triggers = new EDD\Emails\Triggers();
    $id = 987650000 + random_int( 1000, 9999 );
    $sent_orders = array();
    foreach ( array( array( 0, false ), array( 0, true ), array( 49, false ), array( 49, true ) ) as $case ) {
        $order = new CH_Email_Fixture_Order( ++$id, $case[0], $case[1] );
        $flags[$id]['_edd_should_send_order_receipt'] = '1';
        $triggers->send_order_emails( $id, $order );
        $triggers->send_order_emails( $id, $order ); // native consumed flag prevents a duplicate
        email_check( empty( $flags[$id]['_edd_should_send_order_receipt'] ), 'Native receipt marker was not consumed.' );
        $sent_orders[] = $order->get_number();
    }
    foreach ( array( 'pending', 'failed', 'revoked' ) as $status ) {
        $order = new CH_Email_Fixture_Order( ++$id, 49, false, $status );
        $flags[$id]['_edd_should_send_order_receipt'] = '1';
        $triggers->send_order_emails( $id, $order );
        email_check( isset( $flags[$id]['_edd_should_send_order_receipt'] ), 'Uncompleted order incorrectly attempted a receipt.' );
    }
    $refund_email = edd_get_email_by( 'email_id', 'order_refund' );
    email_check( $refund_email && ! $refund_email->is_enabled(), 'Refund email setting changed; review expected local behavior.' );
    $captured = mailpit_messages();
    email_check( $captured['total'] === $initial['total'] + 4, 'Expected exactly four receipt messages and no pending/failed/duplicate messages.' );
    $matched = array();
    foreach ( $captured['messages'] as $message ) {
        foreach ( $sent_orders as $number ) {
            if ( strpos( $message['Subject'], $number ) === false ) { continue; }
            $raw = wp_remote_get( 'http://127.0.0.1:18025/api/v1/message/' . rawurlencode( $message['ID'] ), array( 'timeout' => 5 ) );
            $detail = json_decode( wp_remote_retrieve_body( $raw ), true );
            $html = $detail['HTML'] ?? '';
            email_check( strpos( $html, 'Trial Version (2 Characters)' ) !== false && strpos( $html, 'Subtotal:' ) !== false, 'Purchase snapshot or totals missing.' );
            email_check( ! preg_match( '/AWSAccessKeyId|X-Amz-|eddfile=|token=|payment_key|license_key|s3\.amazonaws/i', $html ), 'Sensitive delivery data in receipt.' );
            email_check( strpos( $html, 'GST tax invoice' ) !== false, 'Receipt document scope missing.' );
            $matched[] = array( 'mailpit_id' => $message['ID'], 'subject' => $message['Subject'] );
        }
    }
    email_check( count( $matched ) === 4, 'Could not verify every captured receipt.' );
    echo wp_json_encode( array( 'captured' => $matched, 'duplicates' => 0, 'pending_failed_revoked_receipts' => 0,
        'refund_email' => 'disabled, settings preserved', 'database_changes' => 'rolled back; no orders or customers created' ), JSON_PRETTY_PRINT ), PHP_EOL;
} finally {
    $wpdb->query( 'ROLLBACK' );
}
