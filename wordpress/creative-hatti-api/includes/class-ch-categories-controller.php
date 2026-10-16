<?php
/**
 * Categories REST controller.
 *
 * @package CreativeHattiAPI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Product category endpoints.
 */
class CH_Categories_Controller {
	private const TAXONOMY = 'download_category';

	/**
	 * Products controller for category product pagination.
	 *
	 * @var CH_Products_Controller
	 */
	private $products_controller;

	/**
	 * Constructor.
	 *
	 * @param CH_Products_Controller $products_controller Products controller.
	 */
	public function __construct( CH_Products_Controller $products_controller ) {
		$this->products_controller = $products_controller;
	}

	/**
	 * Register routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			CH_API::NAMESPACE,
			'/categories',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_categories' ),
				'permission_callback' => array( 'CH_API', 'public_read_permission' ),
			)
		);

		register_rest_route(
			CH_API::NAMESPACE,
			'/categories/(?P<slug>[a-zA-Z0-9-_]+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_category' ),
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

	/**
	 * List product categories.
	 *
	 * @return WP_REST_Response
	 */
	public function get_categories() {
		$terms = get_terms(
			array(
				'taxonomy'   => self::TAXONOMY,
				'hide_empty' => false,
				'orderby'    => 'name',
				'order'      => 'ASC',
			)
		);

		if ( is_wp_error( $terms ) ) {
			return CH_API::error( 'categories_unavailable', 'Categories are unavailable.', 500 );
		}

		$data = array_map( array( $this, 'term_dto' ), $terms );

		return CH_API::collection(
			$data,
			array(
				'page'        => 1,
				'per_page'    => count( $data ),
				'total'       => count( $data ),
				'total_pages' => 1,
			)
		);
	}

	/**
	 * Get category info and paginated category products.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function get_category( WP_REST_Request $request ) {
		$term = get_term_by( 'slug', sanitize_title( $request['slug'] ), self::TAXONOMY );
		if ( ! $term || is_wp_error( $term ) ) {
			return CH_API::error( 'category_not_found', 'Category not found.', 404 );
		}

		$validation = $this->products_controller->validate_collection_request( $request );
		if ( $validation ) {
			return $validation;
		}

		$request->set_param( 'category', $term->slug );
		$query = $this->products_controller->query_products( $request );

		$data = array(
			'category' => $this->term_dto( $term ),
			'products' => $this->products_controller->list_items( $query->posts ),
		);

		return CH_API::success(
			array_merge(
				$data,
				array(
					'pagination' => array(
						'page'        => (int) $request['page'],
						'per_page'    => (int) $request['per_page'],
						'total'       => (int) $query->found_posts,
						'total_pages' => (int) $query->max_num_pages,
					),
				)
			)
		);
	}

	/**
	 * Category DTO.
	 *
	 * @param WP_Term $term Term.
	 * @return array
	 */
	private function term_dto( WP_Term $term ) {
		$title       = get_term_meta( $term->term_id, 'wpseo_title', true );
		$description = get_term_meta( $term->term_id, 'wpseo_desc', true );
		$canonical   = get_term_meta( $term->term_id, 'wpseo_canonical', true );

		$title       = is_scalar( $title ) ? trim( (string) $title ) : '';
		$description = is_scalar( $description ) ? trim( (string) $description ) : '';
		$canonical   = is_scalar( $canonical ) ? trim( (string) $canonical ) : '';

		$seo = array();
		if ( '' !== $title ) {
			$seo['title'] = sanitize_text_field( $title );
		}
		if ( '' !== $description ) {
			$seo['description'] = sanitize_text_field( $description );
		}
		if ( '' !== $canonical ) {
			$canonical = esc_url_raw( $canonical );
			if ( '' !== $canonical ) {
				$seo['canonical_url'] = $canonical;
			}
		}

		return array(
			'id'          => (int) $term->term_id,
			'name'        => $term->name,
			'slug'        => $term->slug,
			'description' => wp_kses_post( $term->description ),
			'count'       => (int) $term->count,
			'parent'      => (int) $term->parent,
			'seo'         => (object) $seo,
		);
	}
}
