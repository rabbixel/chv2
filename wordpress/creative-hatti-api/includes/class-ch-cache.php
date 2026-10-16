<?php
/**
 * Cache helper.
 *
 * @package CreativeHattiAPI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Small cache abstraction for future Redis/object-cache migration.
 */
class CH_Cache {
	private const GROUP = 'creative_hatti_api';

	/**
	 * Get cache value.
	 *
	 * @param string $key Cache key.
	 * @return mixed|false
	 */
	public function get( $key ) {
		return wp_cache_get( $key, self::GROUP );
	}

	/**
	 * Set cache value.
	 *
	 * @param string $key Cache key.
	 * @param mixed  $value Value.
	 * @param int    $ttl TTL seconds.
	 * @return bool
	 */
	public function set( $key, $value, $ttl = 300 ) {
		return wp_cache_set( $key, $value, self::GROUP, absint( $ttl ) );
	}

	/**
	 * Delete cache value.
	 *
	 * @param string $key Cache key.
	 * @return bool
	 */
	public function delete( $key ) {
		return wp_cache_delete( $key, self::GROUP );
	}
}

