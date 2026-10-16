<?php
/** Read-only image reference metadata for published EDD products. */

function cli_option( $name, $fallback ) {
	foreach ( $GLOBALS['argv'] as $argument ) {
		if ( 0 === strpos( $argument, $name . '=' ) ) {
			return substr( $argument, strlen( $name ) + 1 );
		}
	}
	return $fallback;
}

function positive_id( $value ) {
	return max( 0, (int) $value );
}

$wp_root = cli_option( '--wp-root', 'C:/laragon/www/creativehatti' );
$config_path = rtrim( $wp_root, '/\\' ) . '/wp-config.php';
if ( ! is_file( $config_path ) ) {
	fwrite( STDERR, "WordPress config not found: {$config_path}\n" );
	exit( 2 );
}

$config = file_get_contents( $config_path );
$read_constant = static function ( $name ) use ( $config ) {
	$pattern = '~define\s*\(\s*[\'\"]' . preg_quote( $name, '~' ) . '[\'\"]\s*,\s*([\'\"])(.*?)\\1\s*\)~s';
	if ( ! preg_match( $pattern, $config, $matches ) ) {
		return null;
	}
	return stripcslashes( $matches[2] );
};

$db_name = $read_constant( 'DB_NAME' );
$db_user = $read_constant( 'DB_USER' );
$db_password = $read_constant( 'DB_PASSWORD' );
$db_host = $read_constant( 'DB_HOST' );
if ( ! $db_name || null === $db_user || null === $db_password || ! $db_host ) {
	fwrite( STDERR, "Could not read database settings from wp-config.php.\n" );
	exit( 2 );
}
if ( ! preg_match( '~\$table_prefix\s*=\s*[\'\"]([^\'\"]+)[\'\"]\s*;~', $config, $prefix_match ) ) {
	fwrite( STDERR, "Could not read the WordPress table prefix.\n" );
	exit( 2 );
}
$prefix = $prefix_match[1];
if ( ! preg_match( '~^[A-Za-z0-9_]+$~', $prefix ) ) {
	fwrite( STDERR, "Unsupported WordPress table prefix.\n" );
	exit( 2 );
}

$db_host_name = $db_host;
$db_port = 3306;
if ( preg_match( '~^([^:]+):(\d+)$~', $db_host, $host_match ) ) {
	$db_host_name = $host_match[1];
	$db_port = (int) $host_match[2];
}

mysqli_report( MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT );
try {
	$db = new mysqli( $db_host_name, $db_user, $db_password, $db_name, $db_port );
	$db->set_charset( 'utf8mb4' );
	$posts_table = '`' . $prefix . 'posts`';
	$postmeta_table = '`' . $prefix . 'postmeta`';
	$page_size = min( 5000, max( 1, (int) cli_option( '--page-size', 5000 ) ) );
	$count_result = $db->query( "SELECT COUNT(*) AS total FROM {$posts_table} WHERE post_type = 'download' AND post_status = 'publish'" );
	$published_total = (int) $count_result->fetch_assoc()['total'];
	$count_result->free();
	$total_products = 0;
	$products = array();
	$no_image_ids = array();
	$reference_issues = array();
	$metadata_issues = array();
	$attachment_references = array();

	$last_product_id = 0;
	for ( $offset = 0; $offset < $published_total; $offset += $page_size ) {
		$product_sql = "SELECT p.ID, p.post_name, MAX(thumb.meta_value) AS featured_id, MAX(gallery.meta_value) AS gallery_value
			FROM {$posts_table} AS p
			LEFT JOIN {$postmeta_table} AS thumb ON thumb.post_id = p.ID AND thumb.meta_key = '_thumbnail_id'
			LEFT JOIN {$postmeta_table} AS gallery ON gallery.post_id = p.ID AND gallery.meta_key = 'vdw_gallery_id'
			WHERE p.post_type = 'download' AND p.post_status = 'publish' AND p.ID > {$last_product_id}
			GROUP BY p.ID, p.post_name ORDER BY p.ID LIMIT {$page_size}";
		$product_result = $db->query( $product_sql );
		while ( $row = $product_result->fetch_assoc() ) {
			$total_products++;
			$product_id = (int) $row['ID'];
			$last_product_id = $product_id;
		$featured_id = positive_id( $row['featured_id'] ?? 0 );
		$gallery_ids = array();
		$gallery_raw = $row['gallery_value'] ?? '';
		$gallery_metadata_invalid = false;
		if ( '' !== $gallery_raw && null !== $gallery_raw ) {
			$decoded = @unserialize( $gallery_raw, array( 'allowed_classes' => false ) );
			if ( ! is_array( $decoded ) ) {
				$gallery_metadata_invalid = true;
				$metadata_issues[ $product_id ][] = array(
					'attachment_id' => null,
					'role' => 'Gallery',
					'reason' => 'invalid_gallery_metadata',
				);
			} else {
				$gallery_ids = $decoded;
			}
		}

		$has_reference = false;
		$product_entry = array( 'id' => $product_id, 'slug' => $row['post_name'], 'images' => array() );
		if ( $featured_id ) {
			$has_reference = true;
			$product_entry['images'][] = array( 'id' => $featured_id, 'role' => 'Featured' );
			$attachment_references[ $featured_id ][] = array( 'product_id' => $product_id, 'role' => 'Featured' );
		}
		foreach ( $gallery_ids as $gallery_id ) {
			$gallery_id = is_numeric( $gallery_id ) ? positive_id( $gallery_id ) : 0;
			if ( ! $gallery_id ) {
				$reference_issues[ $product_id ][] = array(
					'attachment_id' => null,
					'role' => 'Gallery',
					'reason' => 'missing_attachment',
				);
				continue;
			}
			$has_reference = true;
			$product_entry['images'][] = array( 'id' => $gallery_id, 'role' => 'Gallery' );
			$attachment_references[ $gallery_id ][] = array( 'product_id' => $product_id, 'role' => 'Gallery' );
		}
		if ( ! $has_reference && ! $gallery_metadata_invalid ) {
			$no_image_ids[] = $product_id;
		}
		$products[] = $product_entry;
	}
		$product_result->free();
	}

	$attachment_files = array();
	$seen_attachments = array();
	foreach ( array_chunk( array_keys( $attachment_references ), 5000 ) as $id_chunk ) {
		$ids_sql = implode( ',', array_map( 'intval', $id_chunk ) );
		$attachment_sql = "SELECT p.ID, p.post_type, p.post_parent,
			MAX(CASE WHEN pm.meta_key = '_wp_attached_file' THEN pm.meta_value END) AS attached_file,
			MAX(CASE WHEN pm.meta_key = '_wp_attachment_metadata' THEN pm.meta_value END) AS attachment_metadata,
			MAX(CASE WHEN pm.meta_key = '_wp_attachment_image_alt' THEN pm.meta_value END) AS alt
			FROM {$posts_table} AS p
			LEFT JOIN {$postmeta_table} AS pm ON pm.post_id = p.ID
			WHERE p.ID IN ({$ids_sql}) GROUP BY p.ID, p.post_type, p.post_parent";
		$attachment_result = $db->query( $attachment_sql );
		while ( $row = $attachment_result->fetch_assoc() ) {
			$attachment_id = (int) $row['ID'];
			$seen_attachments[ $attachment_id ] = true;
			if ( 'attachment' !== $row['post_type'] ) {
				foreach ( $attachment_references[ $attachment_id ] as $reference ) {
					$reference_issues[ $reference['product_id'] ][] = array(
						'attachment_id' => $attachment_id,
						'role' => $reference['role'],
						'reason' => 'missing_attachment',
					);
				}
				continue;
			}

			$metadata = is_string( $row['attachment_metadata'] )
				? @unserialize( $row['attachment_metadata'], array( 'allowed_classes' => false ) )
				: null;
			$attached_file = is_string( $row['attached_file'] )
				? ltrim( str_replace( '\\', '/', $row['attached_file'] ), '/' )
				: '';
			$original_file = is_array( $metadata ) && ! empty( $metadata['original_image'] )
				? basename( $metadata['original_image'] )
				: null;
			$source_file = $attached_file;
			if ( $original_file && $attached_file ) {
				$directory = dirname( $attached_file );
				$source_file = ( '.' === $directory ? '' : $directory . '/' ) . $original_file;
			}
			$metadata_available = is_array( $metadata ) && '' !== $source_file;
			$attachment_files[ (string) $attachment_id ] = array(
				'source_file' => $source_file,
				'original_file' => $original_file,
				'metadata_available' => $metadata_available,
				'width' => is_array( $metadata ) && ! empty( $metadata['width'] ) ? (int) $metadata['width'] : null,
				'height' => is_array( $metadata ) && ! empty( $metadata['height'] ) ? (int) $metadata['height'] : null,
				'parent_id' => (int) $row['post_parent'],
				'alt' => is_string( $row['alt'] ) ? $row['alt'] : '',
			);
			if ( ! $metadata_available ) {
				foreach ( $attachment_references[ $attachment_id ] as $reference ) {
					$metadata_issues[ $reference['product_id'] ][] = array(
						'attachment_id' => $attachment_id,
						'role' => $reference['role'],
						'reason' => 'missing_attachment_metadata',
					);
				}
			}
		}
		$attachment_result->free();
	}

	foreach ( $attachment_references as $attachment_id => $references ) {
		if ( isset( $seen_attachments[ $attachment_id ] ) ) {
			continue;
		}
		foreach ( $references as $reference ) {
			$reference_issues[ $reference['product_id'] ][] = array(
				'attachment_id' => $attachment_id,
				'role' => $reference['role'],
				'reason' => 'missing_attachment',
			);
		}
	}

	ksort( $reference_issues );
	ksort( $metadata_issues );
	echo json_encode(
		array(
			'total_products' => $total_products,
			'products' => $products,
			'attachment_files' => $attachment_files,
			'no_image_product_ids' => $no_image_ids,
			'reference_issues' => $reference_issues,
			'metadata_issues' => $metadata_issues,
		),
		JSON_UNESCAPED_SLASHES
	);
	$db->close();
} catch ( Throwable $error ) {
	fwrite( STDERR, 'Read-only database audit failed: ' . $error->getMessage() . "\n" );
	exit( 3 );
}
