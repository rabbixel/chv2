<?php
/**
 * Public EDD download-tag archives for the Next.js storefront.
 *
 * @package CreativeHattiAPI
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class CH_Tags_Controller {
	private $products_controller;

	public function __construct( CH_Products_Controller $products_controller ) {
		$this->products_controller = $products_controller;
	}

	public function register_routes() {
		register_rest_route(
			CH_API::NAMESPACE,
			'/tags/(?P<slug>[a-zA-Z0-9_-]+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_tag' ),
				'permission_callback' => array( 'CH_API', 'public_read_permission' ),
				'args'                => array_merge(
					$this->products_controller->collection_args(),
					array(
						'slug' => array(
							'required'          => true,
							'sanitize_callback' => 'sanitize_title',
						),
					)
				),
			)
		);
	}

	public function get_tag( WP_REST_Request $request ) {
		$term = get_term_by( 'slug', sanitize_title( $request['slug'] ), 'download_tag' );
		if ( ! $term || is_wp_error( $term ) ) {
			return CH_API::error( 'tag_not_found', 'Tag not found.', 404 );
		}

		$validation = $this->products_controller->validate_collection_request( $request );
		if ( $validation ) {
			return $validation;
		}

		// Query exact EDD taxonomy membership, never a keyword approximation.
		$query = new WP_Query(
			array(
				'post_type'              => 'download',
				'post_status'            => 'publish',
				'has_password'           => false,
				'posts_per_page'         => (int) $request['per_page'],
				'paged'                  => (int) $request['page'],
				'ignore_sticky_posts'    => true,
				'update_post_meta_cache' => true,
				'update_post_term_cache' => true,
				'orderby'               => 'date',
				'order'                 => 'DESC',
				'tax_query'             => array(
					array(
						'taxonomy'         => 'download_tag',
						'field'            => 'term_id',
						'terms'            => array( (int) $term->term_id ),
						'include_children' => false,
					),
				),
			)
		);

		$seo = array();
		foreach ( array(
			'wpseo_title'     => 'title',
			'wpseo_desc'      => 'description',
			'wpseo_canonical' => 'canonical_url',
		) as $key => $output_key ) {
			$value = get_term_meta( $term->term_id, $key, true );
			if ( is_scalar( $value ) && '' !== trim( (string) $value ) ) {
				$seo[ $output_key ] = 'canonical_url' === $output_key
					? esc_url_raw( (string) $value )
					: sanitize_text_field( (string) $value );
			}
		}

		return CH_API::success(
			array(
				'tag' => array(
					'id'          => (int) $term->term_id,
					'name'        => $term->name,
					'slug'        => $term->slug,
					'description' => wp_kses_post( $term->description ),
					'count'       => (int) $query->found_posts,
					'seo'         => (object) $seo,
				),
				'products'   => $this->products_controller->list_items( $query->posts ),
				'pagination' => array(
					'page'        => (int) $request['page'],
					'per_page'    => (int) $request['per_page'],
					'total'       => (int) $query->found_posts,
					'total_pages' => max( 1, (int) $query->max_num_pages ),
				),
			)
		);
	}
}
