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
			$data = array(
				'type'     => 'variable',
				'currency' => $currency,
				'options'  => $this->variable_prices( $post_id ),
			);

			return $include_type ? $data : $this->minimum_variable_price( $data );
		}

		// EDD normalizes absent/malformed fixed metadata to zero. Only an
		// explicitly valid stored price may be presented as a free purchase.
		$stored = get_post_meta( $post_id, 'edd_price', true );
		$amount = is_numeric( $stored ) && is_finite( (float) $stored ) && (float) $stored >= 0
			? ( function_exists( 'edd_get_download_price' ) ? edd_get_download_price( $post_id ) : $stored ) : null;
		$amount = is_numeric( $amount ) && is_finite( (float) $amount ) && (float) $amount >= 0 ? (float) $amount : null;

		$data = array(
			'amount'    => $amount,
			'formatted' => $this->format_amount( $amount, $currency ),
			'currency'  => $currency,
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

			$amount = isset( $price['amount'] ) && is_numeric( $price['amount'] ) ? (float) $price['amount'] : null;
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
		$amounts = wp_list_pluck( $price['options'], 'amount' );
		$amounts = array_filter( $amounts, static function ( $amount ) { return is_numeric( $amount ) && is_finite( (float) $amount ) && (float) $amount >= 0; } );
		$amount  = $amounts ? min( $amounts ) : null;

		return array(
			'class'     => ! $amounts ? 'invalid' : ( max( $amounts ) == 0 ? 'free' : ( min( $amounts ) == 0 ? 'mixed' : 'paid' ) ),
			'amount'    => $amount,
			'formatted' => $this->format_amount( $amount, $price['currency'] ),
			'currency'  => $price['currency'],
		);
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

