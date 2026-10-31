<?php
/** Focused CORS origin-policy tests; does not bootstrap or mutate WordPress. */
define( 'ABSPATH', __DIR__ . '/' );

function add_action() {}
function add_filter() {}
function home_url() { return 'http://creativehatti.test'; }
function wp_parse_url( $url, $component = -1 ) { return parse_url( $url, $component ); }
function apply_filters( $tag, $value ) {
	if ( 'ch_api_allowed_origins' === $tag && isset( $GLOBALS['test_allowed_origins'] ) ) {
		return $GLOBALS['test_allowed_origins'];
	}
	return $value;
}

require_once dirname( __DIR__ ) . '/wordpress/creative-hatti-api/includes/class-ch-api.php';

$assertions = 0;
function check_cors( $condition, $message ) {
	global $assertions;
	++$assertions;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: $message\n" );
		exit( 1 );
	}
}

$allowed_origin = new ReflectionMethod( 'CH_API', 'allowed_cors_origin' );
$allowed_origin->setAccessible( true );

putenv( 'CH_API_ALLOWED_ORIGINS=https://store.example.test,http://localhost:3000' );
check_cors( 'https://store.example.test' === $allowed_origin->invoke( null, 'https://STORE.EXAMPLE.TEST' ), 'environment origins are exact and hostname casing is normalized' );
check_cors( 'http://localhost:3000' === $allowed_origin->invoke( null, 'http://localhost:3000' ), 'configured local Next origin is accepted' );
check_cors( '' === $allowed_origin->invoke( null, 'https://evil.example' ), 'unconfigured external origin is rejected' );
check_cors( '' === $allowed_origin->invoke( null, 'null' ), 'opaque null origin is rejected' );
check_cors( '' === $allowed_origin->invoke( null, 'https://store.example.test/path' ), 'origins with paths are rejected' );
check_cors( '' === $allowed_origin->invoke( null, 'javascript://store.example.test' ), 'non-http schemes are rejected' );

putenv( 'CH_API_ALLOWED_ORIGINS=' );
check_cors( '' === $allowed_origin->invoke( null, 'http://localhost:3000' ), 'explicit empty environment value disables even local defaults' );

unset( $GLOBALS['test_allowed_origins'] );
putenv( 'CH_API_ALLOWED_ORIGINS' );
check_cors( 'http://localhost:3000' === $allowed_origin->invoke( null, 'http://localhost:3000' ), 'local .test host enables only the local storefront default' );
check_cors( '' === $allowed_origin->invoke( null, 'https://store.example.test' ), 'local default does not grant arbitrary remote origins' );

putenv( 'CH_API_ALLOWED_ORIGINS=' );
$GLOBALS['test_allowed_origins'] = array( 'https://from-filter.example' );
check_cors( 'https://from-filter.example' === $allowed_origin->invoke( null, 'https://from-filter.example' ), 'site filter can supply an environment-specific origin' );
check_cors( '' === $allowed_origin->invoke( null, 'https://evil.example' ), 'filter allowlist rejects other origins' );

echo 'PASS: ' . $assertions . " CORS origin-policy assertions\n";
