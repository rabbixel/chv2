<?php
/** Editorial discovery, event scheduling and trusted-page image reuse. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class CH_Home_Content {
 const LIMIT = 40;

 public static function defaults( $section ) {
  if ( 'discovery' === $section ) {
   $definitions = array(
    array( 'Logos', 'Marks, badges & monograms', 'logo', 'logo-design' ),
    array( 'Banners', 'Promo & social banners', 'banner', 'social-media' ),
    array( 'Characters', 'Mythology to modern', 'character', 'character-bundles' ),
    array( 'Bundles', 'Consistent packs', 'bundle', 'character-bundles' ),
    array( 'Websites', 'Heroes & web graphics', 'website', 'website' ),
    array( 'Flyers', 'Local business flyers', 'flyer', 'flyers' ),
    array( 'Freebies', 'Free creative assets', 'freebie', 'freebies' ),
    array( 'Cards', 'Greetings & invites', 'greeting card', '' ),
   );
   return array_map( function ( $item ) {
    $term = $item[3] ? get_term_by( 'slug', $item[3], CH_Home_Sections::TAXONOMY ) : false;
    return array( 'title' => $item[0], 'caption' => $item[1], 'query' => $item[2],
     'category_id' => $term ? $term->term_id : 0, 'icon' => strtolower( $item[0] ), 'image_id' => 0,
     'product_id' => 0, 'priority' => 0, 'event_date' => '', 'show_from' => '', 'hide_after' => '', 'pinned' => false );
   }, $definitions );
  }
  // Confirmed 2026 dates; administrators must add next year's lunar dates.
  $definitions = array(
   array( 'Dussehra', 'dussehra', '2026-10-20', 30 ),
   array( 'Dhanteras', 'dhanteras', '2026-11-06', 20 ),
   array( 'Diwali', 'diwali', '2026-11-08', 10 ),
   array( 'Indian Weddings', 'wedding', '', 0 ),
   array( 'Greeting Cards', 'greeting card', '', 0 ),
   array( 'Social Media', 'social media', '', 0 ),
   array( 'Logo Templates', 'logo', '', 0 ),
   array( 'Business Flyers', 'flyer', '', 0 ),
   array( 'Indian Culture', 'cultural', '', 0 ),
   array( 'Character Bundles', 'character bundle', '', 0 ),
  );
  return array_map( function ( $item ) {
   return array( 'title' => $item[0], 'query' => $item[1], 'event_date' => $item[2], 'priority' => $item[3],
    'caption' => '', 'category_id' => 0, 'image_id' => 0, 'product_id' => 0,
    'show_from' => '', 'hide_after' => '', 'pinned' => false, 'icon' => $item[1] );
  }, $definitions );
 }

 public static function keywords() {
  return array( 'Illustration', 'Banner', 'Indian Design', 'Cartoon Character', 'Vector', 'Vector Illustration',
   'India', 'Background', 'Design', 'Creative Design', 'Vector Character', 'Social Media', 'Logo Design',
   'Flyer', 'Website', 'Business Card', 'Invitation', 'Character Bundle', 'Indian Wedding', 'Mythology',
   'Profession', 'Food', 'Education', 'Healthcare', 'Dussehra', 'Dhanteras', 'Diwali', 'Festival Banner',
   'Greeting Card', 'Background Pattern' );
 }

 private static function date( $value ) {
  if ( ! is_string( $value ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) { return ''; }
  $date = DateTimeImmutable::createFromFormat( '!Y-m-d', $value );
  return $date && $date->format( 'Y-m-d' ) === $value ? $value : '';
 }

 public static function sanitize( $input ) {
  $output = array();
  foreach ( array( 'discovery', 'celebrations' ) as $section ) {
   $output[ $section . '_enabled' ] = ! empty( $input[ $section . '_enabled' ] );
   $output[ $section ] = array();
   $limit = 'discovery' === $section ? 12 : self::LIMIT;
   $rows = isset( $input[ $section ] ) && is_array( $input[ $section ] ) ? $input[ $section ] : array();
   foreach ( array_slice( $rows, 0, $limit ) as $row ) {
    if ( ! is_array( $row ) ) { continue; }
    $title = sanitize_text_field( $row['title'] ?? '' );
    if ( ! $title ) { continue; }
    $term_id = absint( $row['category_id'] ?? 0 );
    $term = $term_id ? get_term( $term_id, CH_Home_Sections::TAXONOMY ) : false;
    $image_id = absint( $row['image_id'] ?? 0 );
    $product_id = absint( $row['product_id'] ?? 0 );
    $from = self::date( $row['show_from'] ?? '' );
    $until = self::date( $row['hide_after'] ?? '' );
    $invalid = false;
    foreach ( array( 'event_date', 'show_from', 'hide_after' ) as $field ) {
     if ( ! empty( $row[ $field ] ) && ! self::date( $row[ $field ] ) ) { $invalid = true; }
    }
    if ( $invalid || ( $from && $until && $from > $until ) ) {
     add_settings_error( CH_Home_Sections::OPTION, 'invalid_schedule', 'A card was skipped because its dates are invalid or its visibility window is reversed.' );
     continue;
    }
    $output[ $section ][] = array(
     'title' => $title, 'caption' => sanitize_text_field( $row['caption'] ?? '' ),
     'query' => sanitize_text_field( $row['query'] ?? '' ) ?: $title,
     'category_id' => $term && ! is_wp_error( $term ) ? $term_id : 0,
     'image_id' => CH_Home_Sections::image_dto( $image_id ) ? $image_id : 0,
     'product_id' => 'download' === get_post_type( $product_id ) && 'publish' === get_post_status( $product_id ) ? $product_id : 0,
     'icon' => sanitize_key( $row['icon'] ?? '' ),
     'event_date' => self::date( $row['event_date'] ?? '' ), 'show_from' => $from, 'hide_after' => $until,
     'priority' => min( 100, max( 0, (int) ( $row['priority'] ?? 0 ) ) ), 'pinned' => ! empty( $row['pinned'] ),
    );
   }
  }
  $output['keywords_enabled'] = ! empty( $input['keywords_enabled'] );
  $raw = is_string( $input['keywords'] ?? null ) ? $input['keywords'] : '';
  $output['keywords'] = implode( "\n", array_slice( array_values( array_unique( array_filter( array_map( 'sanitize_text_field', preg_split( '/[\r\n,]+/', $raw ) ) ) ) ), 0, 100 ) );
  $output['keywords_rotate'] = ! empty( $input['keywords_rotate'] );
  $output['trusted_enabled'] = ! empty( $input['trusted_enabled'] );
  $page_id = absint( $input['trusted_page_id'] ?? 0 );
  $output['trusted_page_id'] = 'page' === get_post_type( $page_id ) && 'publish' === get_post_status( $page_id ) ? $page_id : 0;
  delete_transient( 'ch_home_default_artwork' );
  return $output;
 }

 private static function rows( $settings, $section ) {
  return ! empty( $settings[ $section . '_enabled' ] ) ? ( $settings[ $section ] ?? array() ) : self::defaults( $section );
 }

 /** Eligibility is evaluated on every API request in India time, with no cron dependency. */
 public static function active( $rows, $today ) {
  $rows = array_values( array_filter( $rows, function ( $row ) use ( $today ) {
   $event = ! empty( $row['event_date'] ) ? new DateTimeImmutable( $row['event_date'], new DateTimeZone( 'Asia/Kolkata' ) ) : null;
   $from = $row['show_from'] ?: ( $event ? $event->modify( '-60 days' )->format( 'Y-m-d' ) : '' );
   $until = $row['hide_after'] ?: ( $event ? $event->modify( '+2 days' )->format( 'Y-m-d' ) : '' );
   return ( ! $from || $today >= $from ) && ( ! $until || $today <= $until );
  } ) );
  foreach ( $rows as $index => &$row ) { $row['_order'] = $index; }
  unset( $row );
  usort( $rows, function ( $a, $b ) {
   return (int) $b['pinned'] <=> (int) $a['pinned']
    ?: (int) ! empty( $b['event_date'] ) <=> (int) ! empty( $a['event_date'] )
    ?: $b['priority'] <=> $a['priority']
    ?: strcmp( $a['event_date'], $b['event_date'] )
    ?: $a['_order'] <=> $b['_order'];
  } );
  return array_slice( $rows, 0, 10 );
 }

 /** Resolve a bounded product preview only for default cards; cache choices for a week. */
 private static function default_image( $row ) {
  $cache = get_transient( 'ch_home_default_artwork' );
  $cache = is_array( $cache ) ? $cache : array();
  $key = md5( $row['query'] . ':' . $row['category_id'] );
  if ( ! array_key_exists( $key, $cache ) ) {
   $args = array( 'post_type' => 'download', 'post_status' => 'publish', 'posts_per_page' => 1,
    'fields' => 'ids', 'no_found_rows' => true, 'meta_key' => '_thumbnail_id',
    'orderby' => 'ID', 'order' => 'DESC' );
   if ( $row['category_id'] ) {
    $args['tax_query'] = array( array( 'taxonomy' => CH_Home_Sections::TAXONOMY, 'terms' => $row['category_id'] ) );
   } else { $args['s'] = $row['query']; }
   $products = get_posts( $args );
   $cache[ $key ] = $products ? get_post_thumbnail_id( $products[0] ) : 0;
   set_transient( 'ch_home_default_artwork', $cache, WEEK_IN_SECONDS );
  }
  return CH_Home_Sections::image_dto( $cache[ $key ] );
 }

 private static function tiles( $rows, $defaults ) {
  $tiles = array();
  foreach ( $rows as $index => $row ) {
   $term = $row['category_id'] ? get_term( $row['category_id'], CH_Home_Sections::TAXONOMY ) : false;
   $image = CH_Home_Sections::image_dto( $row['image_id'] );
   if ( ! $image && ! empty( $row['product_id'] ) && 'publish' === get_post_status( $row['product_id'] ) ) {
    $image = CH_Home_Sections::image_dto( get_post_thumbnail_id( $row['product_id'] ) );
   }
   if ( ! $image && $defaults ) { $image = self::default_image( $row ); }
   $tiles[] = array( 'id' => 'home-' . sanitize_title( $row['title'] ) . '-' . $index,
    'title' => $row['title'], 'caption' => $row['caption'], 'query' => $row['query'],
    'category_slug' => $term && ! is_wp_error( $term ) ? $term->slug : '',
    'image' => $image, 'icon' => $row['icon'], 'hue' => 150 );
  }
  return $tiles;
 }

 /** Read attachment IDs from WPBakery, Gutenberg galleries and image blocks. */
 public static function attachment_ids( $content ) {
  $content = html_entity_decode( $content, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
  $content = str_replace( array( '“', '”', '″' ), '"', $content );
  $ids = array();
  preg_match_all( '/\[(vc_single_image|vc_images_carousel|vc_gallery|gallery)\b([^\]]*)\]|<!--\s+wp:(?:image|gallery)\s+(\{.*?\})\s*(?:\/)?-->|wp-image-(\d+)/s', $content, $matches, PREG_SET_ORDER );
  foreach ( $matches as $match ) {
   if ( ! empty( $match[1] ) ) {
    $attributes = shortcode_parse_atts( $match[2] );
    $values = $attributes['image'] ?? $attributes['images'] ?? $attributes['ids'] ?? '';
    $ids = array_merge( $ids, array_map( 'absint', explode( ',', $values ) ) );
   } elseif ( ! empty( $match[3] ) ) {
    $attributes = json_decode( $match[3], true );
    $ids = array_merge( $ids, isset( $attributes['id'] ) ? array( absint( $attributes['id'] ) ) : array_map( 'absint', $attributes['ids'] ?? array() ) );
   } elseif ( ! empty( $match[4] ) ) { $ids[] = absint( $match[4] ); }
  }
  return array_slice( array_values( array_unique( array_filter( $ids ) ) ), 0, 30 );
 }

 private static function trusted( $settings ) {
  if ( isset( $settings['trusted_enabled'] ) && ! $settings['trusted_enabled'] ) { return array(); }
  $page = ! empty( $settings['trusted_page_id'] ) ? get_post( $settings['trusted_page_id'] ) : get_page_by_path( 'trusted-by' );
  if ( ! $page || 'page' !== $page->post_type || 'publish' !== $page->post_status ) { return array(); }
  $brands = array();
  foreach ( self::attachment_ids( $page->post_content ) as $id ) {
   $image = CH_Home_Sections::image_dto( $id );
   if ( ! $image ) { continue; }
   $name = $image['alt'] ?: sanitize_text_field( get_the_title( $id ) );
   $brands[] = array( 'id' => $id, 'name' => $name, 'image' => $image );
  }
  return $brands;
 }

 public static function data( $settings ) {
  $today = new DateTimeImmutable( 'now', new DateTimeZone( 'Asia/Kolkata' ) );
  $keywords = ! empty( $settings['keywords_enabled'] )
   ? array_values( array_filter( explode( "\n", $settings['keywords'] ?? '' ) ) ) : self::keywords();
  if ( ! empty( $settings['keywords_rotate'] ) && count( $keywords ) > 30 ) {
   $offset = (int) floor( $today->getTimestamp() / WEEK_IN_SECONDS ) % count( $keywords );
   $keywords = array_merge( array_slice( $keywords, $offset ), array_slice( $keywords, 0, $offset ) );
  }
  return array(
   'discovery_tiles' => self::tiles( self::rows( $settings, 'discovery' ), empty( $settings['discovery_enabled'] ) ),
   'seasonal_collections' => self::tiles( self::active( self::rows( $settings, 'celebrations' ), $today->format( 'Y-m-d' ) ), empty( $settings['celebrations_enabled'] ) ),
   'keywords' => array_slice( $keywords, 0, 30 ), 'trusted_brands' => self::trusted( $settings ),
  );
 }

 public static function render( $settings, $terms ) {
  foreach ( array( 'discovery' => 'What are you creating today?', 'celebrations' => 'Scheduled celebrations' ) as $section => $title ) {
   $rows = isset( $settings[ $section ] ) && is_array( $settings[ $section ] ) ? $settings[ $section ] : self::defaults( $section );
   // Populate the editor with the same preview choices as the live defaults.
   // Enabling a section preserves those choices rather than replacing them with empty artwork.
   if ( ! isset( $settings[ $section ] ) ) {
    foreach ( $rows as &$row ) {
     $image = self::default_image( $row );
     $row['image_id'] = $image ? $image['id'] : 0;
    }
    unset( $row );
   }
   if ( ! $rows ) { $rows = array( array() ); }
   ?>
   <div class="card"><h2><?php echo esc_html( $title ); ?></h2>
    <label><input type="checkbox" name="ch_home_sections[<?php echo esc_attr( $section ); ?>_enabled]" value="1" <?php checked( ! empty( $settings[ $section . '_enabled' ] ) ); ?>>Use these choices on the storefront</label>
    <p class="description">Unchecked uses curated defaults with product previews. Choose an image or a published product ID to use its featured image. Row order controls discovery tiles. An enabled empty section is hidden.</p>
    <?php if ( 'celebrations' === $section ) : ?><p>Dates use Asia/Kolkata. Without explicit visibility dates, events appear 60 days before and expire 2 days after. Undated cards are evergreen. Pinned cards come first, then events, priority and date. Only 10 active cards appear. Add lunar festival dates for each year.</p><?php endif; ?>
    <div class="ch-home-rows" data-section="<?php echo esc_attr( $section ); ?>" data-limit="<?php echo 'discovery' === $section ? 12 : 40; ?>">
     <?php foreach ( $rows as $index => $row ) { self::render_row( $section, $index, $row, $terms ); } ?>
    </div>
    <button type="button" class="button ch-home-add-row" data-section="<?php echo esc_attr( $section ); ?>">Add card</button>
    <script type="text/html" id="ch-home-row-template-<?php echo esc_attr( $section ); ?>"><?php self::render_row( $section, '__INDEX__', array(), $terms ); ?></script>
   </div>
   <?php
  }
  ?>
  <div class="card"><h2>Explore popular themes</h2>
   <label><input type="checkbox" name="ch_home_sections[keywords_enabled]" value="1" <?php checked( ! empty( $settings['keywords_enabled'] ) ); ?>>Use this keyword list</label>
   <p>One keyword per line. Keep at least 20–30 useful terms. Up to 100 are stored; 30 appear on the homepage.</p>
   <textarea class="widefat" rows="10" name="ch_home_sections[keywords]"><?php echo esc_textarea( ! empty( $settings['keywords_enabled'] ) ? ( $settings['keywords'] ?? '' ) : implode( "\n", self::keywords() ) ); ?></textarea>
   <label><input type="checkbox" name="ch_home_sections[keywords_rotate]" value="1" <?php checked( ! empty( $settings['keywords_rotate'] ) ); ?>>Rotate 30 keywords weekly when the pool contains more than 30</label>
  </div>
  <div class="card"><h2>Trusted clients</h2>
   <label><input type="checkbox" name="ch_home_sections[trusted_enabled]" value="1" <?php checked( ! isset( $settings['trusted_enabled'] ) || $settings['trusted_enabled'] ); ?>>Sync logos from the trusted-by page</label>
   <p>Leave the page ID blank to use the published page at trusted-by. WPBakery image/gallery shortcodes and Gutenberg images are supported. Logos retain page order; duplicates and missing images are skipped. Image alt text or attachment title supplies the brand name.</p>
   <label>Source page ID (optional) <input type="number" min="1" name="ch_home_sections[trusted_page_id]" value="<?php echo esc_attr( ! empty( $settings['trusted_page_id'] ) ? $settings['trusted_page_id'] : '' ); ?>"></label>
   <p><?php echo esc_html( count( self::trusted( $settings ) ) . ' valid client images found.' ); ?></p>
  </div>
  <?php
 }

 private static function render_row( $section, $index, $row, $terms ) {
  $prefix = 'ch_home_sections[' . $section . '][' . $index . ']';
  $image = CH_Home_Sections::image_dto( $row['image_id'] ?? 0 );
  ?>
  <div class="postbox ch-home-row"><div class="inside">
   <?php foreach ( array( 'title' => 'Title', 'caption' => 'Caption', 'query' => 'Search query', 'icon' => 'Vector fallback (logos, banners, characters, bundles, websites, flyers, freebies, cards, dussehra, dhanteras, diwali, wedding)' ) as $field => $label ) : ?>
    <p><label><?php echo esc_html( $label ); ?><input class="widefat" type="text" name="<?php echo esc_attr( $prefix . '[' . $field . ']' ); ?>" value="<?php echo esc_attr( $row[ $field ] ?? '' ); ?>"></label></p>
   <?php endforeach; ?>
   <p><label>Category destination (optional)<select class="widefat" name="<?php echo esc_attr( $prefix . '[category_id]' ); ?>"><option value="0">Use search query</option>
    <?php if ( ! is_wp_error( $terms ) ) { foreach ( $terms as $term ) { ?>
     <option value="<?php echo esc_attr( $term->term_id ); ?>" <?php selected( $row['category_id'] ?? 0, $term->term_id ); ?>><?php echo esc_html( $term->name ); ?></option>
    <?php } } ?></select></label></p>
   <p><label>Product ID for featured image (optional) <input type="number" min="0" name="<?php echo esc_attr( $prefix . '[product_id]' ); ?>" value="<?php echo esc_attr( ! empty( $row['product_id'] ) ? $row['product_id'] : '' ); ?>"></label></p>
   <p class="description">Leave blank when choosing artwork below. A selected image takes priority over the product's featured image.</p>
   <p class="ch-home-image"><input type="hidden" class="ch-home-image-id" name="<?php echo esc_attr( $prefix . '[image_id]' ); ?>" value="<?php echo esc_attr( $row['image_id'] ?? 0 ); ?>">
    <img class="ch-home-image-preview" src="<?php echo esc_url( $image['url'] ?? '' ); ?>" alt="" <?php echo $image ? '' : 'hidden'; ?>>
    <button type="button" class="button ch-home-select-image">Choose artwork</button><button type="button" class="button ch-home-remove-image" <?php echo $image ? '' : 'hidden'; ?>>Remove image</button>
   </p>
   <?php if ( 'celebrations' === $section ) : ?>
    <?php foreach ( array( 'event_date' => 'Event date', 'show_from' => 'Show from', 'hide_after' => 'Hide after' ) as $field => $label ) : ?>
     <p><label><?php echo esc_html( $label ); ?> <input type="date" name="<?php echo esc_attr( $prefix . '[' . $field . ']' ); ?>" value="<?php echo esc_attr( $row[ $field ] ?? '' ); ?>"></label></p>
    <?php endforeach; ?>
    <p><label>Priority <input type="number" min="0" max="100" name="<?php echo esc_attr( $prefix . '[priority]' ); ?>" value="<?php echo esc_attr( $row['priority'] ?? 0 ); ?>"></label>
     <label><input type="checkbox" name="<?php echo esc_attr( $prefix . '[pinned]' ); ?>" value="1" <?php checked( ! empty( $row['pinned'] ) ); ?>>Pin within its visibility window</label></p>
   <?php endif; ?>
   <button type="button" class="button-link ch-home-move-up">Move up</button>
   <button type="button" class="button-link ch-home-move-down">Move down</button>
   <button type="button" class="button-link-delete ch-home-remove-row">Remove card</button>
  </div></div>
  <?php
 }
}
