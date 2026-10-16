<?php
/**
 * Media normalization.
 *
 * @package CreativeHattiAPI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Converts WordPress attachments to safe media DTOs.
 */
class CH_Media {
	/**
	 * Build media DTO from attachment ID.
	 *
	 * @param int         $attachment_id Attachment ID.
	 * @param string|null $size Image size. Defaults to full/original representation.
	 * @return array|null
	 */
	public function attachment( $attachment_id, $size = 'full' ) {
		$attachment_id = absint( $attachment_id );
		if ( ! $attachment_id || 'attachment' !== get_post_type( $attachment_id ) ) {
			return null;
		}

		$src = wp_get_attachment_image_src( $attachment_id, $size ? $size : 'full' );
		if ( ! $src ) {
			$url = wp_get_attachment_url( $attachment_id );
			if ( ! $url ) {
				return null;
			}

			$src = array( $url, null, null );
		}

		return array(
			'id'     => $attachment_id,
			'url'    => esc_url_raw( $src[0] ),
			'width'  => isset( $src[1] ) ? absint( $src[1] ) : null,
			'height' => isset( $src[2] ) ? absint( $src[2] ) : null,
			'alt'    => sanitize_text_field( get_post_meta( $attachment_id, '_wp_attachment_image_alt', true ) ),
		);
	}

	/**
	 * Build featured image DTO.
	 *
	 * @param int $post_id Product ID.
	 * @return array|null
	 */
	public function featured_image( $post_id ) {
		$thumbnail_id = get_post_thumbnail_id( $post_id );

		return $thumbnail_id ? $this->attachment( $thumbnail_id, 'full' ) : null;
	}

	/**
	 * Build gallery DTO from vdw_gallery_id meta.
	 *
	 * @param int $post_id Product ID.
	 * @return array
	 */
	public function gallery( $post_id ) {
		$raw = get_post_meta( $post_id, 'vdw_gallery_id', true );
		if ( empty( $raw ) ) {
			return array();
		}

		$ids = is_array( $raw ) ? $raw : maybe_unserialize( $raw );
		if ( ! is_array( $ids ) ) {
			return array();
		}

		$gallery = array();
		foreach ( $ids as $id ) {
			if ( ! is_numeric( $id ) ) {
				continue;
			}

			$item = $this->attachment( absint( $id ), 'full' );
			if ( $item ) {
				$gallery[] = $item;
			}
		}

		return $gallery;
	}
}

