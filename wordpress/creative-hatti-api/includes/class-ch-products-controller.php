<?php
/**
 * Products REST controller.
 *
 * @package CreativeHattiAPI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Product endpoints.
 */
class CH_Products_Controller {
	private const POST_TYPE = 'download';
	private const CATEGORY_TAXONOMY = 'download_category';
	private const TAG_TAXONOMY = 'download_tag';

	/**
	 * Product transformer.
	 *
	 * @var CH_Product_Transformer
	 */
	private $transformer;

	/**
	 * Constructor.
	 *
	 * @param CH_Product_Transformer $transformer Transformer.
	 */
	public function __construct( CH_Product_Transformer $transformer ) {
		$this->transformer = $transformer;
	}

	/**
	 * Register routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			CH_API::NAMESPACE,
			'/products',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_products' ),
				'permission_callback' => array( 'CH_API', 'public_read_permission' ),
				'args'                => $this->collection_args(),
			)
		);

		register_rest_route(
			CH_API::NAMESPACE,
			'/products/sitemap',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_sitemap_products' ),
				'permission_callback' => array( 'CH_API', 'public_read_permission' ),
				'args'                => array(
					'page'     => array(
						'default'           => 1,
						'sanitize_callback' => 'absint',
					),
					'per_page' => array(
						'default'           => 48,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
		register_rest_route(
			CH_API::NAMESPACE,
			'/products/(?P<id>\d+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_product_by_id' ),
				'permission_callback' => array( 'CH_API', 'public_read_permission' ),
				'args'                => array(
					'id' => array(
						'required'          => true,
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $value ) {
							return absint( $value ) > 0;
						},
					),
				),
			)
		);

		register_rest_route(
			CH_API::NAMESPACE,
			'/products/slug/(?P<slug>[a-zA-Z0-9-_]+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_product_by_slug' ),
				'permission_callback' => array( 'CH_API', 'public_read_permission' ),
				'args'                => array(
					'slug' => array(
						'required'          => true,
						'sanitize_callback' => 'sanitize_title',
					),
				),
			)
		);
	}

	/**
	 * Collection request args.
	 *
	 * @return array
	 */
	public function collection_args() {
		return array(
			'page'     => array(
				'default'           => 1,
				'sanitize_callback' => 'absint',
			),
			'per_page' => array(
				'default'           => 24,
				'sanitize_callback' => 'absint',
			),
			'category' => array(
				'sanitize_callback' => 'sanitize_title',
			),
			'orderby'  => array(
				'default'           => 'date',
				'sanitize_callback' => 'sanitize_key',
			),
			'order'    => array(
				'default'           => 'desc',
				'sanitize_callback' => 'sanitize_key',
			),
			'featured' => array(
				'sanitize_callback' => array( $this, 'sanitize_boolean_param' ),
			),
		);
	}

	/**
	 * Transform posts to list DTOs.
	 *
	 * @param array $posts Posts.
	 * @return array
	 */
	public function list_items( array $posts ) {
		return array_map( array( $this->transformer, 'list_item' ), $posts );
	}

	/**
	 * Get product collection.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function get_products( WP_REST_Request $request ) {
		$validation = $this->validate_collection_request( $request );
		if ( $validation ) {
			return $validation;
		}

		$query = $this->query_products( $request );

		$data = $this->list_items( $query->posts );

		return CH_API::collection(
			$data,
			array(
				'page'        => (int) $request['page'],
				'per_page'    => (int) $request['per_page'],
				'total'       => (int) $query->found_posts,
				'total_pages' => (int) $query->max_num_pages,
			)
		);
	}

	/**
	 * Query products for collection contexts.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_Query
	 */
	public function query_products( WP_REST_Request $request ) {
		$args = array(
			'post_type'              => self::POST_TYPE,
			'post_status'            => 'publish',
			'posts_per_page'         => (int) $request['per_page'],
			'paged'                  => (int) $request['page'],
			'ignore_sticky_posts'    => true,
			'update_post_meta_cache' => true,
			'update_post_term_cache' => true,
			'tax_query'              => array(),
			'meta_query'             => array(),
		);

		$orderby = $request['orderby'] ? $request['orderby'] : 'date';
		$order   = strtoupper( $request['order'] ? $request['order'] : 'desc' );

		if ( 'price' === $orderby ) {
			$args['meta_key'] = 'edd_price';
			$args['orderby']  = 'meta_value_num';
			$args['order']    = $order;
		} elseif ( 'title' === $orderby ) {
			$args['orderby'] = 'title';
			$args['order']   = $order;
		} else {
			$args['orderby'] = 'date';
			$args['order']   = $order;
		}

		if ( $request['category'] ) {
			$args['tax_query'][] = array(
				'taxonomy' => self::CATEGORY_TAXONOMY,
				'field'    => 'slug',
				'terms'    => sanitize_title( $request['category'] ),
			);
		}

		if ( null !== $request['featured'] && '' !== $request['featured'] ) {
			if ( $this->sanitize_boolean_param( $request['featured'] ) ) {
				$args['meta_query'][] = array(
					'key'     => 'edd_feature_download',
					'compare' => 'EXISTS',
				);
			} else {
				$args['meta_query'][] = array(
					'key'     => 'edd_feature_download',
					'compare' => 'NOT EXISTS',
				);
			}
		}

		if ( empty( $args['tax_query'] ) ) {
			unset( $args['tax_query'] );
		}

		if ( empty( $args['meta_query'] ) ) {
			unset( $args['meta_query'] );
		}

		return new WP_Query( $args );
	}

	/**
	 * Validate product collection parameters.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|null
	 */
	public function validate_collection_request( WP_REST_Request $request ) {
		$page = absint( $request['page'] );
		if ( $page < 1 ) {
			return CH_API::error( 'invalid_page', 'Page must be greater than or equal to 1.', 400 );
		}

		$per_page = absint( $request['per_page'] );
		if ( $per_page < 1 || $per_page > 48 ) {
			return CH_API::error( 'invalid_per_page', 'per_page must be between 1 and 48.', 400 );
		}

		if ( ! in_array( $request['orderby'], array( 'date', 'title', 'price' ), true ) ) {
			return CH_API::error( 'invalid_orderby', 'orderby must be one of date, title, or price.', 400 );
		}

		if ( ! in_array( strtolower( $request['order'] ), array( 'asc', 'desc' ), true ) ) {
			return CH_API::error( 'invalid_order', 'order must be asc or desc.', 400 );
		}

		return null;
	}

	/**
	 * Return a bounded, lightweight page of public product sitemap records.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function get_sitemap_products( WP_REST_Request $request ) {
		$page     = max( 1, absint( $request['page'] ) );
		$per_page = absint( $request['per_page'] );

		if ( $per_page < 1 || $per_page > 48 ) {
			return CH_API::error( 'invalid_per_page', 'per_page must be between 1 and 48.', 400 );
		}

		global $wpdb;
		$offset = ( $page - 1 ) * $per_page;
		$total  = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(ID)
				 FROM {$wpdb->posts}
				 WHERE post_type = %s AND post_status = %s AND post_password = ''",
				self::POST_TYPE,
				'publish'
			)
		);

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT p.post_name AS slug, p.post_modified_gmt AS modified, yoast.canonical_url
				 FROM {$wpdb->posts} AS p
				 LEFT JOIN (
					SELECT post_id, MAX(meta_value) AS canonical_url
					FROM {$wpdb->postmeta}
					WHERE meta_key = %s
					GROUP BY post_id
				 ) AS yoast ON yoast.post_id = p.ID
				 WHERE p.post_type = %s AND p.post_status = %s AND p.post_password = ''
				 ORDER BY p.ID ASC
				 LIMIT %d OFFSET %d",
				'_yoast_wpseo_canonical',
				self::POST_TYPE,
				'publish',
				$per_page,
				$offset
			),
			ARRAY_A
		);

		$items = array_map(
			static function ( $row ) {
				$item = array(
					'slug'     => $row['slug'],
					'modified' => mysql_to_rfc3339( $row['modified'] ),
				);
				if ( ! empty( $row['canonical_url'] ) ) {
					$canonical = esc_url_raw( $row['canonical_url'] );
					if ( '' !== $canonical ) {
						$item['canonical_url'] = $canonical;
					}
				}
				return $item;
			},
			is_array( $rows ) ? $rows : array()
		);

		return CH_API::success(
			array(
				'total' => $total,
				'items' => $items,
			)
		);
	}
	/**
	 * Get product by ID.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_product_by_id( WP_REST_Request $request ) {
		$post = get_post( (int) $request['id'] );
		if ( ! $this->is_public_product( $post ) ) {
			return CH_API::error( 'product_not_found', 'Product not found.', 404 );
		}

		return CH_API::success( $this->transformer->single( $post ) );
	}

	/**
	 * Get product by slug.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_product_by_slug( WP_REST_Request $request ) {
		$query = new WP_Query(
			array(
				'name'                   => sanitize_title( $request['slug'] ),
				'post_type'              => self::POST_TYPE,
				'post_status'            => 'publish',
				'posts_per_page'         => 1,
				'ignore_sticky_posts'    => true,
				'update_post_meta_cache' => true,
				'update_post_term_cache' => true,
			)
		);

		if ( ! $query->have_posts() ) {
			return CH_API::error( 'product_not_found', 'Product not found.', 404 );
		}

		return CH_API::success( $this->transformer->single( $query->posts[0] ) );
	}

	/**
	 * Sanitize boolean-like query parameter.
	 *
	 * @param mixed $value Value.
	 * @return bool|null
	 */
	public function sanitize_boolean_param( $value ) {
		if ( null === $value || '' === $value ) {
			return null;
		}

		return filter_var( $value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE );
	}

	/**
	 * Is a post a public product?
	 *
	 * @param mixed $post Post.
	 * @return bool
	 */
	private function is_public_product( $post ) {
		return $post instanceof WP_Post && self::POST_TYPE === $post->post_type && 'publish' === $post->post_status;
	}
}
