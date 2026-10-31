<?php
/**
 * Product DTO transformer.
 *
 * @package CreativeHattiAPI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Converts legacy WordPress/EDD product data into frontend DTOs.
 */
class CH_Product_Transformer {
	/**
	 * Media helper.
	 *
	 * @var CH_Media
	 */
	private $media;

	/**
	 * Constructor.
	 *
	 * @param CH_Media $media Media helper.
	 */
	public function __construct( CH_Media $media ) {
		$this->media = $media;
	}

	/**
	 * Transform a product for list/archive contexts.
	 *
	 * @param WP_Post|int $post Product post.
	 * @return array
	 */
	public function list_item( $post ) {
		$post = get_post( $post );

		return array(
			'id'         => $post->ID,
			'title'      => get_the_title( $post ),
			'slug'       => $post->post_name,
			'price'      => $this->price( $post->ID, false ),
			'image'      => $this->media->featured_image( $post->ID ),
			'categories' => $this->terms( $post->ID, 'download_category' ),
			'featured'   => $this->is_featured( $post->ID ),
			'availability' => $this->availability( $post->ID ),
			'file_type'  => $this->nullable_meta( $post->ID, 'file_type' ),
			'file_size'  => $this->nullable_meta( $post->ID, 'file_size' ),
		);
	}

	/**
	 * Transform a product for detail contexts.
	 *
	 * @param WP_Post|int $post Product post.
	 * @return array
	 */
	public function single( $post ) {
		$post = get_post( $post );

		return array(
			'id'                => $post->ID,
			'title'             => get_the_title( $post ),
			'slug'              => $post->post_name,
			'status'            => $post->post_status,
			'date'              => mysql_to_rfc3339( $post->post_date_gmt ? $post->post_date_gmt : $post->post_date ),
			'modified'          => mysql_to_rfc3339( $post->post_modified_gmt ? $post->post_modified_gmt : $post->post_modified ),
			'description'       => $this->safe_content( $post->post_content ),
			'short_description' => $this->safe_excerpt( $post ),
			'price'             => $this->price( $post->ID, true ),
			'seo'                => $this->seo( $post->ID ),
			'variable_prices'   => $this->variable_prices( $post->ID ),
			'featured_image'    => $this->media->featured_image( $post->ID ),
			'gallery'           => $this->media->gallery( $post->ID ),
			'categories'        => $this->terms( $post->ID, 'download_category' ),
			'tags'              => $this->terms( $post->ID, 'download_tag' ),
			'file_type'         => $this->nullable_meta( $post->ID, 'file_type' ),
			'file_size'         => $this->nullable_meta( $post->ID, 'file_size' ),
			'compatible_with'   => $this->nullable_meta( $post->ID, 'compatible_with' ),
			'documentation'     => $this->documentation( $post->ID ),
			'featured'          => $this->is_featured( $post->ID ),
			'availability'      => $this->availability( $post->ID ),
		);
	}

	private function availability( $product_id ) {
		$service = new CH_Purchase_Limit_Service();
		$state = $service->availability( $product_id, 1 );
		return array( 'available' => (bool) $state['available'], 'sold_out' => (bool) $state['sold_out'], 'remaining' => $state['remaining'] );
	}

	/**
	 * Return the public Yoast metadata consumed by the storefront.
	 *
	 * @param int $post_id Product ID.
	 * @return array
	 */
	private function seo( $post_id ) {
		$title       = get_post_meta( $post_id, '_yoast_wpseo_title', true );
		$description = get_post_meta( $post_id, '_yoast_wpseo_metadesc', true );
		$canonical   = get_post_meta( $post_id, '_yoast_wpseo_canonical', true );
		$post        = get_post( $post_id );

		$title       = is_scalar( $title ) ? trim( (string) $title ) : '';
		$description = is_scalar( $description ) ? trim( (string) $description ) : '';
		$canonical   = is_scalar( $canonical ) ? trim( (string) $canonical ) : '';

		if ( $post instanceof WP_Post && function_exists( 'wpseo_replace_vars' ) ) {
			$title       = wpseo_replace_vars( $title, $post );
			$description = wpseo_replace_vars( $description, $post );
		}

		$seo = array();
		if ( '' !== trim( $title ) ) {
			$seo['title'] = sanitize_text_field( $title );
		}
		if ( '' !== trim( $description ) ) {
			$seo['description'] = sanitize_text_field( $description );
		}
		if ( '' !== $canonical ) {
			$canonical = esc_url_raw( $canonical );
			if ( '' !== $canonical ) {
				$seo['canonical_url'] = $canonical;
			}
		}

		return (object) $seo;
	}
	/**
	 * Build price DTO.
	 *
	 * @param int  $post_id Product ID.
	 * @param bool $include_type Include type field.
	 * @return array
	 */
	public function price( $post_id, $include_type = true ) {
		$currency = function_exists( 'edd_get_currency' ) ? edd_get_currency() : 'INR';

		if ( function_exists( 'edd_has_variable_prices' ) && edd_has_variable_prices( $post_id ) ) {
			$options = $this->variable_prices( $post_id );
			$classification = $this->classify_amounts( array_map( static function ( $option ) { return $option['amount']; }, $options ) );
			$data = array(
				'type' => 'variable', 'currency' => $currency, 'options' => $options,
				'amount' => $classification['valid'] ? $classification['minimum'] : null,
				'formatted' => $this->format_amount( $classification['valid'] ? $classification['minimum'] : null, $currency ),
				'class' => $classification['class'], 'valid' => $classification['valid'],
			);
			return $include_type ? $data : array( 'class' => $data['class'], 'amount' => $data['amount'], 'formatted' => $data['formatted'], 'currency' => $currency );
		}

		// EDD 3.7.2 treats absent fixed-price metadata as zero when variable
		// pricing is disabled. Malformed stored values remain invalid.
		$stored = get_post_meta( $post_id, 'edd_price', true );
		$exists = function_exists( 'metadata_exists' ) ? metadata_exists( 'post', $post_id, 'edd_price' ) : ( '' !== $stored && null !== $stored );
		$raw_valid = ! $exists || ( is_numeric( $stored ) && is_finite( (float) $stored ) && (float) $stored >= 0 );
		$stale_options = ! $exists ? get_post_meta( $post_id, 'edd_variable_prices', true ) : array();
		$no_contradictory_options = ! ( is_array( $stale_options ) ? (bool) array_filter( $stale_options ) : ! empty( $stale_options ) );
		$amount = $raw_valid && $no_contradictory_options
			? ( function_exists( 'edd_get_download_price' ) ? edd_get_download_price( $post_id ) : ( $exists ? $stored : null ) ) : null;
		$amount = is_numeric( $amount ) && is_finite( (float) $amount ) && (float) $amount >= 0 ? (float) $amount : null;
		$classification = null === $amount ? $this->invalid_classification() : $this->classify_amounts( array( $amount ) );

		$data = array(
			'amount'    => $amount,
			'formatted' => $this->format_amount( $amount, $currency ),
			'currency'  => $currency,
			'class'     => $classification['class'],
			'valid'     => $classification['valid'],
		);

		if ( $include_type ) {
			$data = array_merge( array( 'type' => 'single' ), $data );
		}

		return $data;
	}

	/**
	 * Build variable price options.
	 *
	 * @param int $post_id Product ID.
	 * @return array
	 */
	public function variable_prices( $post_id ) {
		$prices = function_exists( 'edd_get_variable_prices' ) ? edd_get_variable_prices( $post_id ) : get_post_meta( $post_id, 'edd_variable_prices', true );
		if ( empty( $prices ) || ! is_array( $prices ) ) {
			return array();
		}

		$currency = function_exists( 'edd_get_currency' ) ? edd_get_currency() : 'INR';
		$default  = get_post_meta( $post_id, '_edd_default_price_id', true );
		$options  = array();

		foreach ( $prices as $key => $price ) {
			if ( ! is_array( $price ) ) {
				continue;
			}

			$amount = isset( $price['amount'] ) && is_numeric( $price['amount'] ) && is_finite( (float) $price['amount'] ) && (float) $price['amount'] >= 0 ? (float) $price['amount'] : null;
			$options[] = array(
				'id'        => is_numeric( $key ) ? (int) $key : sanitize_key( $key ),
				'name'      => isset( $price['name'] ) ? sanitize_text_field( $price['name'] ) : '',
				'amount'    => $amount,
				'formatted' => $this->format_amount( $amount, $currency ),
				'default'   => (string) $default === (string) $key,
			);
		}

		return $options;
	}

	/**
	 * Get terms as DTOs.
	 *
	 * @param int    $post_id Product ID.
	 * @param string $taxonomy Taxonomy.
	 * @return array
	 */
	private function terms( $post_id, $taxonomy ) {
		$terms = get_the_terms( $post_id, $taxonomy );
		if ( empty( $terms ) || is_wp_error( $terms ) ) {
			return array();
		}

		return array_values(
			array_map(
				static function ( $term ) {
					return array(
						'id'   => (int) $term->term_id,
						'name' => $term->name,
						'slug' => $term->slug,
					);
				},
				$terms
			)
		);
	}

	/**
	 * Format amount through EDD when available.
	 *
	 * @param float|null $amount Amount.
	 * @param string     $currency Currency.
	 * @return string|null
	 */
	private function format_amount( $amount, $currency ) {
		if ( null === $amount ) {
			return null;
		}

		if ( function_exists( 'edd_currency_filter' ) && function_exists( 'edd_format_amount' ) ) {
			return html_entity_decode( wp_strip_all_tags( edd_currency_filter( edd_format_amount( $amount ), $currency ) ), ENT_QUOTES, get_bloginfo( 'charset' ) );
		}

		return $currency . ' ' . number_format_i18n( $amount, 2 );
	}

	/**
	 * Return a list-friendly price for variable products.
	 *
	 * @param array $price Variable price data.
	 * @return array
	 */
	private function minimum_variable_price( array $price ) {
		return array( 'class' => $price['class'], 'amount' => $price['amount'], 'formatted' => $price['formatted'], 'currency' => $price['currency'], 'valid' => $price['valid'] );
	}

	private function classify_amounts( $amounts ) {
		if ( ! $amounts ) { return $this->invalid_classification(); }
		$valid = array();
		foreach ( $amounts as $amount ) {
			if ( ! is_numeric( $amount ) || ! is_finite( (float) $amount ) || (float) $amount < 0 ) { return $this->invalid_classification(); }
			$valid[] = (float) $amount;
		}
		$has_free = in_array( 0.0, $valid, true );
		$has_paid = (bool) array_filter( $valid, static function ( $amount ) { return $amount > 0; } );
		$minimum = min( $valid );
		return array( 'valid' => true, 'minimum' => $minimum, 'has_free' => $has_free, 'has_paid' => $has_paid, 'class' => $has_free && $has_paid ? 'mixed' : ( $has_paid ? 'paid' : 'free' ) );
	}

	private function invalid_classification() {
		return array( 'valid' => false, 'minimum' => null, 'has_free' => false, 'has_paid' => false, 'class' => 'invalid' );
	}

	/**
	 * Get nullable string meta.
	 *
	 * @param int    $post_id Product ID.
	 * @param string $key Meta key.
	 * @return string|null
	 */
	private function nullable_meta( $post_id, $key ) {
		$value = get_post_meta( $post_id, $key, true );
		$value = is_scalar( $value ) ? trim( (string) $value ) : '';

		return '' === $value ? null : sanitize_text_field( $value );
	}

	/**
	 * Return documentation flag from legacy string.
	 *
	 * @param int $post_id Product ID.
	 * @return bool|null
	 */
	private function documentation( $post_id ) {
		$value = $this->nullable_meta( $post_id, 'documentation' );
		if ( null === $value ) {
			return null;
		}

		return in_array( strtolower( $value ), array( 'yes', 'y', '1', 'true' ), true );
	}

	/**
	 * Whether product is featured.
	 *
	 * @param int $post_id Product ID.
	 * @return bool
	 */
	private function is_featured( $post_id ) {
		return '' !== get_post_meta( $post_id, 'edd_feature_download', true );
	}

	/**
	 * Return safe HTML content without executing shortcodes.
	 *
	 * @param string $content Raw post content.
	 * @return string
	 */
	private function safe_content( $content ) {
		return wp_kses_post( do_blocks( $content ) );
	}

	/**
	 * Return excerpt only when it does not look like private payment data.
	 *
	 * @param WP_Post $post Product post.
	 * @return string|null
	 */
	private function safe_excerpt( WP_Post $post ) {
		$excerpt = trim( $post->post_excerpt );
		if ( '' === $excerpt ) {
			return null;
		}

		if ( preg_match( '/razorpay|transaction\s*id/i', $excerpt ) ) {
			return null;
		}

		return wp_kses_post( $excerpt );
	}
}

