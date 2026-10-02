<?php
/** Run with php check-content.php /path/to/wordpress (uses WP's real shortcode parser; no database). */
if ( PHP_SAPI !== 'cli' ) { exit; }
define( 'ABSPATH', rtrim( $argv[1] ?? '', '/\\' ) . '/' );
require ABSPATH . 'wp-includes/shortcodes.php';
// WordPress's scalar helper, without loading database-dependent functions.php.
function absint( $value ) { return abs( (int) $value ); }
require __DIR__ . '/homepage-content.php';
function verify( $condition, $message ) {
 if ( ! $condition ) { throw new RuntimeException( $message ); }
}
$content = '[vc_single_image image="13090"] [vc_single_image image=&#8221;13534&#8243;]
 [vc_gallery images="13534,13570"] <!-- wp:image {"id":13565} --> <img class="wp-image-13565">
 <!-- wp:gallery {"ids":[13572,13564]} /--> [gallery ids="13563,13571"]';
verify( CH_Home_Content::attachment_ids( $content ) === array( 13090, 13534, 13570, 13565, 13572, 13564, 13563, 13571 ), 'Mixed image sources must preserve order and deduplicate IDs.' );
$rows = CH_Home_Content::defaults( 'celebrations' );
$titles = array_column( CH_Home_Content::active( $rows, '2026-10-02' ), 'title' );
verify( array_slice( $titles, 0, 3 ) === array( 'Dussehra', 'Dhanteras', 'Diwali' ), 'October must promote upcoming festivals.' );
verify( in_array( 'Dussehra', array_column( CH_Home_Content::active( $rows, '2026-10-22' ), 'title' ), true ), 'The final visibility day is inclusive.' );
verify( ! in_array( 'Dussehra', array_column( CH_Home_Content::active( $rows, '2026-10-23' ), 'title' ), true ), 'Expired festivals must disappear.' );
verify( count( CH_Home_Content::active( $rows, '2027-10-02' ) ) === 4, 'Lunar dates must not repeat into another year.' );
$rows[0]['pinned'] = true;
$rows[0]['show_from'] = '2026-10-10';
$rows[0]['hide_after'] = '2026-10-12';
verify( ! in_array( 'Dussehra', array_column( CH_Home_Content::active( $rows, '2026-10-02' ), 'title' ), true ), 'Pinned entries must respect explicit visibility windows.' );
verify( count( CH_Home_Content::keywords() ) === 30, 'Defaults must include 30 useful keywords.' );
echo "Homepage content checks passed.\n";
