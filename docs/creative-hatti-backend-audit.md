# Creative Hatti — WordPress / EDD Backend Audit

**Scope:** Read-only technical audit of the local Creative Hatti WordPress + Easy Digital Downloads installation (Laragon, Windows) to inform a future custom REST API plugin (`wp-content/plugins/creative-hatti-api/`) backing a separate Next.js frontend.

**Method:** Direct read-only SQL (`SELECT` / `SHOW`) against the MySQL database using the credentials already present in `wp-config.php` (values never printed), plus read-only inspection of plugin/theme source and the `wp-content/uploads` directory structure. No data was modified.

**Date of audit:** 2026-09-30
**Site URL in DB:** `https://creativehatti.test` (local staging copy of the production site)

> **Credentials are never reproduced in this document.** AWS keys, S3 secret, Razorpay keys, PayPal credentials, SMTP settings, salts, and EDD license keys were encountered during inspection and are reported only as *present / absent* or `[REDACTED]`.

---

## 1. Executive Summary

Creative Hatti runs **WordPress 7.1.2** on **PHP 8.3.33** with **MySQL 8.4.3**, using **Easy Digital Downloads 3.7.1** as the commerce layer. The installation is a legacy hybrid: the Mayosis/WPBakery/GridPlus frontend has already been removed from disk (only the block theme `twentytwentyfive` remains active), but its **data footprint is still fully present in `wp_postmeta`**, `wp_termmeta`, `wp_options`, and custom image sizes.

Key findings:

1. **Products are plain WordPress posts** of type `download` (44,801 total; 44,792 published). Title, slug, description, excerpt, status, and dates live in `wp_posts` exactly as expected. Excerpts are essentially unused (44,733 of 44,801 empty).
2. **Price is simple.** `edd_price` on 44,432 products (min 0, max 500,000, avg ~387). Only **33 products** have `edd_variable_prices` (Standard/Extended license tiers) and only 3 order items in the whole database reference a `price_id`. Variable pricing is effectively a legacy corner.
3. **Files are all S3.** `edd_download_files` exists on 44,800 products. Every file entry uses the shape `{index, attachment_id, thumbnail_size, name, file, condition}` with **no `type` key**, and `file` is stored as `<bucket>/<object key>.zip`. The `edd-amazon-s3` plugin intercepts EDD's `edd_requested_file` filter and generates a **presigned S3 URL** at download time. Locally, `uploads/edd/` also holds ~80,704 files / 7.4 GB, so **storage is mixed**: S3 for the `download` product files, local disk for media/symlink residue.
4. **Customers are EDD customers, not WP users.** 6,265 EDD customers, but only 1,578 link to a `wp_users` row. **4,687 are guest customers** with `user_id = 0`. 11,498 completed orders were guest checkouts. Any authenticated Next.js area must handle email-based identity for guests, not just WP user IDs.
5. **Orders are EDD 3.x**: 17,007 rows in `wp_edd_orders` / 18,817 in `wp_edd_order_items`. Ownership resolution is `orders.customer_id → order_items.product_id` with status filtering; there is a clean composite index `order_product_price_id (order_id, product_id, price_id)` that supports it.
6. **Entitlements are well-supported by official EDD APIs**: `edd_order_grants_access_to_download_files()`, `EDD\Downloads\Entitlement`, `edd_get_download_files()`, `edd_is_file_at_download_limit()`. A custom API should call these, not re-implement them.
7. **Software Licensing is installed and populated** (17,828 licenses, 3,462 products, 5,868 customers) but **99% inactive**, has **0 activations**, and **0 licensemeta rows**. It is structurally real but operationally dormant.
8. **Wishlists are tiny**: 354 `edd_wish_list` posts, 485 total items, owned via `post_author`. Retention is trivial.
9. **The dominant technical risk is the tag table, not postmeta.** `wp_term_relationships` holds **3,530,715 rows**, of which **3,414,774 are `download_tag` links across 24,720 terms** — an average of **76 tags per product** (max 134). Serialising a product's tags is by far the most expensive part of a product DTO.
10. **Search infrastructure already exists in the DB but the plugins are gone from disk.** `wp_asp_index` (4.6 M rows, ~1 GB) and `wp_searchwp_index` (610 K rows, ~137 MB) are both orphaned — Ajax Search Pro and SearchWP are not in the current plugin set. This is worth a decision before any new search work.

---

## 2. WordPress Environment

| Item | Value |
|---|---|
| WordPress version | **7.1.2** (`wp-includes/version.php`) |
| PHP version (CLI) | **8.3.33** (ZTS, x64). Laragon also has 8.4.12-nts available. |
| PHP memory_limit | 512M |
| PHP post_max_size / upload_max_filesize | 2G / 2G |
| Database | **MySQL Community Server 8.4.3** |
| DB charset / collation | `utf8mb4` / `utf8_0900_ai_ci` |
| DB host | `localhost` (credentials redacted) |
| sql_mode | `ONLY_FULL_GROUP_BY, STRICT_TRANS_TABLES, NO_ZERO_IN_DATE, NO_ZERO_DATE, ERROR_FOR_DIVISION_BY_ZERO, NO_ENGINE_SUBSTITUTION` |
| Table prefix | **`wp_`** |
| Total tables | 103 |
| Site URL | `https://creativehatti.test` |
| Timezone | `Asia/Kolkata`, date format `d/m/Y` |
| Permalink structure | `/%postname%/` |
| Base currency | **INR** (`edd_settings → currency`) |
| Default gateway | **razorpay** |
| `download_method` | `redirect` |
| `download_link_expiration` | 24 (hours) |
| `logged_in_only` | 1 (downloads require login) |

### Active plugins (10)

| Plugin | Version | Role |
|---|---|---|
| `classic-editor` | 1.7.0 | Classic editor toggle |
| `easy-digital-downloads` | **3.7.1** | Commerce core |
| `easy-digital-downloads-free-link` | n/a (no header) | Front-end direct download link label |
| `edd-amazon-s3` | **2.3.13** (`EDD_AS3_VERSION`) | S3 file storage + presigned URLs |
| `edd-featured-downloads` | 1.0.5 | Featured flag |
| `edd-purchase-limit` | 1.2.23 | Purchase limits |
| `edd-software-licensing` | **3.8.8** | Licensing |
| `edd-wish-lists` | 1.1.10 | Wishlists |
| `razorpay-edd-2.1.0` | n/a | Razorpay payment gateway |
| `wp-migrate-db-pro` | n/a | DB migration tool (mu-plugin shim present: `wp-migrate-db-pro-compatibility.php`) |

**Notable absences:** WPBakery (`js_composer`), Mayosis theme, GridPlus, Ajax Search Pro, SearchWP, Yoast, WooCommerce, ACF (see §14 — data-only residue remains for all of these).

### Installed EDD extensions (all active)

- Amazon S3 2.3.13
- Featured Downloads 1.0.5
- Purchase Limit 1.2.23
- Software Licensing 3.8.8
- Wish Lists 1.1.10
- Free Link (free-downloads link label)
- Razorpay gateway (a first-party EDD gateway rather than a "compatibility" extension)

There is also a `wp_edd_sl_*` option family (26 hashed option rows) and `edd_sl_version` left over from EDD SL — harmless, but residue.

### Active theme

`twentytwentyfive` (Twenty Twenty-Five, block theme). The Mayosis theme is **not on disk**. Its fingerprints survive only as:
- `edd_settings` image-size keys: `mayosis-product-thumb-small`, `mayosis-product-grid-small`, `mayosis-product-wave-small`, `mayosis-grid-small`, `mayosis-grid-list`, `mayosis-single-page-thumbnail`, `mayosis-product-carousel` (all with watermark alignment/repeat settings)
- `wp_attachments` carrying generated sizes named `mayosis-*`
- `Mayosis_lic_Key` option (empty)
- ~hundreds of `grid_plus*` options

### `wp-content` structure relevant to EDD

```
wp-content/
├── mu-plugins/
│   └── wp-migrate-db-pro-compatibility.php
├── plugins/
│   ├── classic-editor/  easy-digital-downloads/  easy-digital-downloads-free-link/
│   ├── edd-amazon-s3/ (incl. bundled aws/aws-sdk-php + guzzle vendor tree)
│   ├── edd-featured-downloads/  edd-purchase-limit/  edd-software-licensing/
│   ├── edd-wish-lists/  razorpay-edd-2.1.0/  wp-migrate-db-pro/
├── themes/
│   └── twentytwentyfive/
├── uploads/
│   ├── 2018 … 2026        product media, year/month folders
│   ├── edd/               80,704 files / ~7.4 GB (2020-2025)
│   └── wp-migrate-db/
```

`uploads/edd/` holds ~7.4 GB. `edd_settings` sets a watermark image (`/2021/08/WaterMark-1.png`) for many registered sizes — those watermarked variants are **baked into the generated image files** and should be reviewed before exposing them to the new frontend.

### Registered post types (with non-zero row counts)

| post_type | Status | Count | Relevance |
|---|---|---|---|
| `attachment` | inherit | 90,331 | Media |
| **`download`** | **publish** | **44,792** | **Products** |
| `download` | draft | 9 | Products |
| `edd_log` | publish | 41,160 | Legacy EDD 2.x sale/file_download logs |
| `edd_payment` | publish / abandoned / pending / failed | 16,512 / 638 / 20 / 8 | **Legacy EDD 2.x payments** (see §10) |
| `revision` | inherit | 12,272 | WP revisions |
| `edd_wish_list` | private / publish | 309 / 45 | Wishlists |
| `eddcurrency` | publish | 28 | Currency switcher (a Mayosis-era extension) |
| `edd_discount` | inactive / active | 7 / 2 | Discounts |
| `page` | publish | 120 | Site + EDD system pages |
| `post` | publish | 59 | Blog |
| `testimonial`, `stars_testimonial`, `fes-forms`, `wpcf7_contact_form`, `popup`, `popup_theme`, `aoc_popup`, `themify_popup`, `gusta_section`, `is_search_form`, `wpes_setting`, `post_grid`, `vc_grid_item`, `elementor_library`, `envira`, `custom_css`, `wp_navigation`, `nav_menu_item`, `oembed_cache`, `edd_license_log` (1) | various | small | Legacy/other plugins |

Total `wp_posts` rows: 206,455 (table is ~149 MB / 195 K estimated rows per `information_schema`).

### Registered taxonomies

| Taxonomy | Terms | Total assignments | Attached to `download`? |
|---|---|---|---|
| **`download_tag`** | **24,720** | **3,414,709** | Yes — 3,414,774 links / 44,798 products |
| **`download_category`** | **35** | **73,644** | Yes — 73,660 links / 44,797 products |
| `post_tag` | 21 | 19 | No |
| `nav_menu` | 9 | 75 | No |
| `category` | 5 | 127 | No |
| `edd_log_type` | 4 | 41,787 | No (on `edd_log`) |
| `elementor_library_type` | 4 | 0 | No |
| `post_format` | 2 | 0 | No |
| `wp_theme` | 1 | 1 | No |

Only **two** taxonomies touch products. There are **no Mayosis-specific custom taxonomies** still in use.

---

## 3. EDD Architecture

- Products = `download` post type, registered by `easy-digital-downloads/includes/post-types.php:100` with:
  - `public => true`, `publicly_queryable => true`, `has_archive` (set), `hierarchical => false`
  - `capability_type => 'product'`
  - `show_in_rest => true`, `rest_base => 'edd-downloads'`
  - `supports => title, editor, thumbnail, excerpt, revisions, author`
- Business logic lives in `EDD_Download` (`includes/class-edd-download.php`) which uses the `EDD\Downloads\Traits\Files` trait (`src/Downloads/Traits/Files.php`) for file access.
- Price/limit/refund settings are **global-only** in practice:
  - `edd_settings.file_download_limit` — **not set** (defaults to 0 = unlimited)
  - `edd_settings.refund_window` / `refundability` — **not set**
  - `_edd_download_limit`, `_edd_refund_window`, `_edd_refundability` — **0 rows in postmeta**
  - ⇒ Every product is unlimited-download, refundable, with no per-product override.
- `EDD\Downloads\Entitlement` (new in 3.7.1) is the file-level permission object. It only matters for variable-priced products, which are rare here (33).
- Registered REST meta for `download` (in `includes/class-edd-register-meta.php`): `edd_price` (float, `show_in_rest`), `edd_variable_prices` (object, `show_in_rest`), `edd_download_files` (array, **not** `show_in_rest`; write-protected by `can_write_download_files_meta`), `_edd_bundled_products` (array, `show_in_rest`).

### Scale summary

| Entity | Count |
|---|---|
| Products (`download`, all) | 44,801 |
| Products published | 44,792 |
| Distinct products ever sold (complete order items) | 3,158 |
| EDD customers | 6,265 |
| WP users | 6,095 |
| Orders (`wp_edd_orders`) | 17,007 |
| Order items | 18,817 |
| Licenses | 17,828 |
| File download log rows | 18,596 |
| Attachments | 90,331 |
| Wishlists | 354 |
| `wp_postmeta` rows | 2,527,953 (~687 MB) |
| `wp_term_relationships` rows | 3,530,715 (~254 MB) |
| `download` postmeta rows | 1,881,554 (avg **42 per product**) |

---

## 4. Product Data Map

### Core WordPress fields

| Concept | Source | Notes |
|---|---|---|
| ID | `wp_posts.ID` | |
| Title | `wp_posts.post_title` | |
| Slug | `wp_posts.post_name` | 0 duplicates among published; 1 empty |
| Main description | `wp_posts.post_content` | **HTML**, avg 420 chars, max 4,231. Heavy inline `<span style>`/`<strong>` from the old editor. |
| Excerpt | `wp_posts.post_excerpt` | 44,733 / 44,801 empty. Two hold **Razorpay Transaction ID** text — must not be exposed. |
| Status | `wp_posts.post_status` | `publish` (44,792), `draft` (9) |
| Published | `wp_posts.post_date` | 2020-02-19 → 2024-04-02 |
| Modified | `wp_posts.post_modified` | → 2026-08-02 |
| Author / vendor | `wp_posts.post_author` | 5 uploader accounts dominate: `uploader_ch` (33,671), `uploader2` (8,374), `uploader3` (2,572), `Uploader4` (105), plus admins (79). **Not a real vendor model** — a single `wp_fes_vendors` row exists (1 vendor, 2 products) from an FES extension that is no longer installed. |
| Password | `wp_posts.post_password` | empty |
| Menu order | `wp_posts.menu_order` | unused |

Products per year: 2020 → 372, 2021 → 11,646, 2022 → 19,071, 2023 → 13,111, 2024 → 601.

### Sampled products (10, chosen to cover the requested mix)

| ID | Why sampled | Price | Files | Cats | Tags |
|---|---|---|---|---|---|
| **15653** | Oldest published (2020) | 1100.00 | 1 | 2 | 82 |
| **250744** | Newest published (2024) | 11.00 | 1 | 1 | 71 |
| **3544** | Free (price 0) | 0.00 | 1 | 2 | 55 |
| **2499** | Featured product (`edd_feature_download`) | 3999.00 | 1 | 2 | 49 |
| **3780** | Variable pricing (Standard 449 / Extended 3999) | 99.00 base | 1 | 1 | 75 |
| **161470** | Purchase limit `-1` | 99.00 | 1 | 2 | 92 |
| **30701** | Most licenses issued (340) | — | 1 | 2 | 75 |
| **2858** | High sales (77–78), 2 attached images | — | 1 | 2 | 18 |
| **202649** | Non-empty `_edd_bundled_products` | 251.00 | 1 | 1 | 89 |
| **2530** | Wishlist container (not a product) | — | — | — | — |

**Products with multiple downloadable files are effectively non-existent:** files-per-product distribution over 3,000 sampled products is `{1 file: 2998, 2 files: 2}`. DTO design can assume a single file for ~99.99% of products, but must not *assume* it.

**Products with multiple images:** 44,963 attachments have `post_parent` = a `download`; per-product attachment count is `{1: 2863, 2: 120, 0: 8, 3: 8, 4: 1}` in a 3,000-sample. Combined with `vdw_gallery_id`, the practical image set per product is **2 images** (small thumbnail + large preview).

#### Example field map — PRODUCT ID 2499 (featured, paid, S3, SL-enabled)

```
PRODUCT ID: 2499

Core WordPress (wp_posts):
- title       -> post_title    "Seth Motumal - The Clever Shopkeeper Vector Bundle"
- slug        -> post_name     "seth-motumal-the-clever-shopkeeper-vector-bundle"
- content     -> post_content  (HTML, 1342 chars)
- excerpt     -> post_excerpt  (330 chars, real marketing copy)
- status      -> post_status   publish
- published   -> post_date     2021-02-08 11:20:49
- modified    -> post_modified 2021-09-17 17:10:38
- author      -> post_author   1

EDD:
- base price      -> edd_price                       "3999.00"
- variable prices -> edd_variable_prices             a:0:{}
- files           -> edd_download_files              a:1:{1:{index,attachment_id,thumbnail_size,name,file,condition}}
- feature flag    -> edd_feature_download            "1"
- purchase limit  -> (absent; site default)
- download limit  -> (absent; global file_download_limit unset = unlimited)
- free-link file  -> _edd_free_downloads_file        ""
- bundled items   -> _edd_bundled_products            a:1:{0:"0"}  (no real bundle)
- sales (net)     -> _edd_download_sales              "7"   (row duplicated)
- earnings (net)  -> _edd_download_earnings           "2999.250000"
- sales (gross)   -> _edd_download_gross_sales        "7"
- earnings(gross) -> _edd_download_gross_earnings    "11997"

Media:
- featured image  -> _thumbnail_id = 12974
                    -> _wp_attached_file 2021/02/Indian-Shopkeeper-Vector-Bundle-Set-Thumbnail-Small.jpg
                    -> sizes: medium, thumbnail, mayosis-product-thumb-small, mayosis-product-grid-small,
                             mayosis-product-wave-small, mayosis-grid-small, mayosis-grid-list, sl-small, sl-large
                    -> 400x300, alt = "Indian-Shopkeeper-Vector-Bundle-Set-Thumbnail-Small"
- gallery         -> vdw_gallery_id = ["12975"]  (one attachment, 512px "Medium" preview)
- other attached  -> attachment 2860 (orphaned 2020-era "Large" image, no longer in gallery)

Taxonomies:
- category -> download_category : 49 character-bundles (root), 3857 profession (child of 49)
- tags     -> download_tag      : 49 tags (businessman, business, idea, working, cartoon, ...)

EDD Software Licensing:
- enabled          -> _edd_sl_enabled  "1"
- upgrade paths    -> _edd_sl_upgrade_paths  a:1:{1:{download_id:2499, price_id:false, discount:"0.00", pro_rated:0}}
- beta file key    -> _edd_sl_beta_upgrade_file_key "1"
- license lifetime -> edd_sl_download_lifetime "1" + _edd_sl_exp_length "1" + _edd_sl_exp_unit "days"
- key template     -> _cl_key_template "****-****-****-********"

Other (do not expose):
- _siq_post_orig_image_url (SearchWP/ASP image cache)
- _yoast_wpseo_* (8 keys)
- _wp_old_date (x3), _wp_old_slug
- _wpb_vc_js_status = "false"   <- WPBakery residue
- _wp_page_template = "default"
- _edit_lock, _edit_last
```

#### Example field map — PRODUCT ID 3780 (variable pricing)

```
- edd_price            -> "99.00"                       (base; the "from" price)
- edd_variable_prices  -> a:2:{
                            1 => {index:1, name:"Standard License",  amount:"449.00",  license_limit:"0"},
                            2 => {index:2, name:"Extended License", amount:"3999.00", license_limit:"0"}
                          }
- _edd_default_price_id -> "1"
- files                 -> single file, condition:"all"  (no price-option restriction)
```

The 33 variable-priced products split into: 9 Onam/Onam-sale banners, 18 Diwali banners, 1 farmer-protest bundle (3999 / "Trial Version"), 1 vectorization service (24999, price_id 2 only), plus the free trial tier on one banner. Only **3 order items in the entire database** carry a non-null `price_id` — variable pricing is a commercial dead-end that still must render correctly.

#### Example field map — PRODUCT ID 250744 (newest, no `_edd_free_downloads_file`)

Note this newer product lacks `_edd_free_downloads_file`, `_edd_sl_enabled`, `compatible_with`, `documentation`, and `_wp_old_date`, and it has an **anomalous** `edd_download_files` entry where `attachment_id` holds a filename string instead of `0`. Any DTO must not assume `_edd_free_downloads_file` or `_edd_sl_enabled` exist.

---

## 5. Important Post Meta

All 92 distinct meta keys on `download` posts, by number of products using them. **92 keys, 42 rows per product on average.**

### EDD core

| Meta key | Products | Purpose | Origin | Expose to API? |
|---|---|---|---|---|
| `edd_price` | 44,432 | Base price (float string) | EDD | YES |
| `edd_variable_prices` | 44,767 | Price options (empty array on 44,734) | EDD | YES (normalized) |
| `edd_download_files` | 44,800 | File list | EDD | YES (names/count only) |
| `_edd_download_sales` | 44,801 | Net sales count | EDD | YES (as `salesCount`) |
| `_edd_download_earnings` | 44,801 | Net earnings | EDD | No (internal) |
| `_edd_download_gross_sales` | 33,771 | Gross sales | EDD | No |
| `_edd_download_gross_earnings` | 33,771 | Gross earnings | EDD | No |
| `_edd_bundled_products` | 11,934 | Bundle member IDs (mostly `["0"]`) | EDD | Only if non-trivial |
| `_edd_bundled_products_conditions` | 44,767 | Per-price bundle conditions | EDD | No |
| `_edd_default_price_id` | 35 | Default price option | EDD | YES (variable only) |
| `_edd_price_options_mode` | 1 | Single-price mode flag | EDD | Internal |
| `_variable_pricing` | 1 | Legacy flag | EDD | No |

**Not present at all (0 rows):** `_edd_download_limit`, `_edd_refund_window`, `_edd_refundability`, `_edd_product_files`, `_edd_product_type`. ⇒ no SKU-bearing `get_sku()` data, no per-product type override (all default), no per-product limits.

### Media

| Meta key | Products | Purpose | Origin |
|---|---|---|---|
| `_thumbnail_id` | 44,798 | Featured image attachment ID (3 products missing) | WP core |
| `_wp_attachment_image_alt` | 89,847 (attachments) | Alt text — well populated | WP core |
| `_wp_attached_file` | 90,331 | Relative path on disk | WP core |
| `_wp_attachment_metadata` | 90,328 | width/height/file/filesize/sizes/image_meta | WP core |
| `vdw_gallery_id` | 44,799 | **Serialized array of attachment IDs** — the product's preview gallery. 1 item on 44,798 products, 2 items on 1. | **VDW / theme-era gallery plugin** (legacy) |
| `_siq_post_orig_image_url` | 4,503 | Original image URL cached by SearchWP/ASP | Search plugin (dead) |
| `_siq_post_thumb`, `_siq_post_thumb_url`, `_siq_post_thumb_large`, `_siq_post_thumb_url_large` | 3 each | ditto | Search plugin (dead) |
| `size_of_image` / `_size_of_image` | 1 each | Stray | Unknown |

### Mayosis / theme product presentation fields (all 44,800 products)

| Meta key | Sample values | Likely purpose |
|---|---|---|
| `file_type` | `EPS, JPG` (26,193) · `EPS, JPG, PNG` (15,203) · `PNG` (1,015) · `EPS, PNG` (928) · `AI, EPS, JPG` (669) · `PSD, JPG` (20) | Asset format list shown on the product page |
| `file_size` | `6.08 MB`, `556 KB`, `1.56 MB` | Download size badge |
| `compatible_with` | `Adobe Illustrator` (43,559) · `Adobe Illustration` (204) · `Adobe Illustrator, Photoshop` (9) | Software compatibility |
| `documentation` | `Yes` / `YES` | Documentation-available flag |
| `product_version` | `""` on 44,798; `3.20 MB`, `CS6, CS6+` on 1 each | Mostly vestigial (looks like a mis-mapped field) |
| `item_unique_id` | `""` on all 44,800 | Vestigial |
| `demo_link` | `""` or `#` | Demo URL (all but 44 empty/`#`) |
| `video_url` | `""` | Preview video |
| `audio_url` | `""` | Preview audio |
| `custom_link` | `""` | Custom CTA link |
| `custom_product_url` | `""` | External product URL |
| `custom-button-title` | `""` | Custom button label |
| `custom-button-url` | `""` | Custom button URL |
| `custom-button-description` | `""` | Custom button text |

> **Recommendation:** `file_type`, `file_size`, `compatible_with`, and `documentation` are genuine product merchandising attributes and should be promoted to first-class DTO fields. `product_version`, `item_unique_id`, `audio_url`, `custom_link` and the `custom-button-*` family are all empty on 44,800/44,800 products and can be dropped from the DTO.

### EDD Software Licensing (product side)

| Meta key | Products | Purpose |
|---|---|---|
| `_edd_sl_enabled` | 43,806 | Licensing on/off for the product |
| `_edd_sl_exp_unit` | 44,800 | `days` (44,193) / `years` (607) |
| `edd_sl_download_lifetime` | 44,800 | Legacy lifetime field |
| `_edd_sl_exp_length` | 2,505 | License duration value |
| `_edd_sl_upgrade_paths` | 33,722 | Self-referential upgrade path (usually to itself) |
| `_edd_sl_beta_upgrade_file_key` | 44,800 | Points at `edd_download_files` index |
| `_edd_sl_version` | 2,119 | Current shipped version |
| `_edd_sl_limit` | 2,119 | Activation limit — **`0` on all 2,119** |
| `_edd_sl_keys` | 2,119 | Empty on all |
| `_edd_sl_changelog` | 2,119 | Changelog text |
| `_edd_sl_beta_version` | 2,119 | Beta version |
| `_edd_sl_beta_files` | 2,119 | Beta file refs |
| `_edd_sl_beta_changelog` | 2,119 | Beta changelog |
| `_cl_key_template` | 8 | License key mask |

### Other EDD extensions

| Meta key | Products | Origin | Purpose |
|---|---|---|---|
| `edd_sr_version` | 11,206 | EDD Software Recurring (removed) | Empty strings |
| `edd_sr_version_limit` | 11,206 | EDD Software Recurring | `0` |
| `edd_sr_batch_max` | 1,459 | EDD Software Recurring | `50` |
| `_edd_purchase_limit` | 669 | EDD Purchase Limit | `1` (668) / `-1` (1) |
| `_edd_purchase_limit_variable_disable` | 2 | EDD Purchase Limit | |
| `_edd_free_downloads_file` | 34,150 | Free-Downloads extension | **`""` on all 34,150** — completely inert |
| `_edd_free_downloads_bypass` | 1 | Free-Downloads | |
| `edd_feature_download` | 28 | EDD Featured Downloads | `"1"` — the only featured set |
| `_edd_hide_purchase_link` | 3 | Unknown | |
| `_dp_original` | 38 | Duplicate Post plugin | |
| `_dp_has_rewrite_republish_copy` | 1 | Duplicate Post | |
| `hits` | 41 | Hit-counter plugin | Popularity counter |
| `product_changelog` | 3 | Unknown | |
| `ac_display_automatically`, `ac_display_reverse`, `ac_head_line` | 3 each | "AJAX Content"/accordion plugin | |
| `somdn_dlcount` | 2 | "Show Most Downloaded Number" | |
| `webpushr_*`, `wpp_send_notification_for_new_post` | 2–3 | WebPushr / WordPress Push plugin | |
| `_size_of_image`, `_select_custom_template`, `select_custom_template` | 1 each | Unknown | |

### SEO / editor residue (not business data)

`_yoast_wpseo_*` — 8 keys, **332,146 rows** (17.7% of all download postmeta), including `_yoast_wpseo_title`, `_yoast_wpseo_metadesc` (44,798), `_yoast_wpseo_focuskw` (44,765), `_yoast_wpseo_focuskeywords`/`_keywordsynonyms` (JSON `[""]` on 9,277), `_yoast_wpseo_content_score`, `_yoast_wpseo_linkdex`, `_yoast_wpseo_primary_download_category` (44,785), `_yoast_wpseo_wordproof_timestamp` (105). Also `_wpb_vc_js_status` (44,800, all `false`), `_wp_page_template` (44,738, all `default`), `_edit_lock` / `_edit_last` (44,801 each), `_wp_old_date` (12,056 products, 12,453 rows), `_wp_old_slug` (340 products, 392 rows; 44 products have >1).

### Term meta (categories)

| `wp_termmeta.meta_key` | Rows | Purpose |
|---|---|---|
| `category_image_main` | 27 | Category hero image URL (Mayosis) |
| `additional_description` | 27 | Extra category copy (Mayosis) |
| `edd_category_template` | 24 | Template assignment (empty) |
| `_edd_category_template` | 24 | Same, ACF-shaped key name, value `field_6049f1465aeb8` |

---

## 6. Product Taxonomies

Only two taxonomies are attached to products.

### `download_category` — hierarchical, curated, small

- **35 terms**: 13 root, 22 child
- **33 used** (have `count > 0`); 73,660 relationships across 44,797 products
- **Average 1.64 categories per product**
- Hierarchical depth observed: 2 levels (`Vector Creatives → Social Media → Portrait/Landscape`)

Top categories (published products):

| Term ID | Slug | Name | Parent | Published products |
|---|---|---|---|---|
| 48 | `vector-creatives` | Vector Creatives | root | 25,201 |
| 3837 | `social-media` | Social Media | 48 | 24,900 |
| 6879 | `illustrations` | Illustrations | root | 15,251 |
| 20301 | `images` | Images | root | 981 |
| 49 | `character-bundles` | Character Bundles | root | 923 |
| 11617 | `portrait` | Portrait | 3837 | 856 |
| 3723 | `logo-design` | Logo Design | root | 774 |
| 3872 | `people` | People | 49 | 760 |
| 16893 | `one-time-logo-sale` | One Time Logo Sale | root | 669 |
| 3857 | `profession` | Profession | 49 | 613 |
| 3865 | `flyers` | Flyers | 48 | 538 |
| 11610 | `landscape-social-media` | Landscape | 3837 | 510 |
| 3885 | `landing-page` | Landing Page | 3884 | 230 |
| 3884 | `website` | Website | 48 | 205 |
| 50 | `freebies` | Freebies | root | 470 |
| 3847 / 3844 / 3853 | `singers` / `actors` / `business-person` | children of freebies | 50 | 165 / 92 / 69 |

Only **2 of 35 categories have a term description** (`social-media`, `one-time-logo-sale`). Categories carry term meta (`category_image_main` for 27 terms, with a handful of real URLs e.g. `character-bundles` → `ghy.jpg`, `one-time-logo-sale` → `Untitled-1.png`).

### `download_tag` — non-hierarchical, massive, low quality

- **24,720 terms**
- **3,414,774 relationships across 44,798 products**
- **Average 76 tags per product**; min 1, max **134**
- `wp_term_relationships` total size ~254 MB — the second-largest table in the database

Heaviest tags: `creative hatti` (42,968), `creativehatti` (42,479), `vector` (41,375), `illustration` (40,606), `design` (38,859), `cartooncharacter` (34,172), `vectorillustration` (33,977), `character` (32,362), `cartoon` (32,150), `indiandesigns` (28,792), `indianillustration` (28,736), `indiangraphics` (28,716), `creativehatticharacters` (28,612), `vectorcharacter` (28,482), `creativedesigns` (28,259).

Quality issues visible in the tail:
- SEO-keyword-stuffed tag names ("happy shivratri festival facebook cover page template vector illustration. Lord Shiva.")
- **Scraped page-title tags** — the longest term (190 chars) is literally an admin table row: `"INR 251 0 INR 0 Last Modified 2023/09/07 at 10:43 am Select Young teacher teaching maths ... — Draft ID: 202823 | Edit | Quick Edit | Trash | Preview Illustrations"`
- Duplicated brand tags: `creative hatti` vs `creativehatti` (both ~43 K)
- Concatenated duplicates: `vectorcharacter` vs `vector character` vs `vectorcharacter vectorillustration`

**This is the single biggest API performance risk.** See §19.

---

## 7. Media Architecture

### Relationship model

| Concept | Storage | Notes |
|---|---|---|
| Featured image | `wp_posts` (`download`).`_thumbnail_id` → `wp_posts.ID` of an `attachment` | 44,798 / 44,801 have one. 3 products have none. |
| Preview gallery | `wp_postmeta.vdw_gallery_id` — **PHP-serialized array of attachment IDs** | 44,799 products; 44,798 have exactly 1 image, 1 has 2. **Verified**: 5,000 / 5,001 sampled IDs resolve to real `attachment` posts. |
| Secondary/legacy images | `wp_posts` (`attachment`).`post_parent` = download ID | 44,963 attachments parented to a download. Per-product: 1 (2,863), 2 (120), 0 (8), 3 (8), 4 (1) in a 3,000-sample. Many are orphans not referenced by the gallery (e.g. product 2499 has attachment 2860 from 2020 that is not in the gallery). |
| File path | `wp_postmeta._wp_attached_file` (attachment) | Relative, e.g. `2021/02/Indian-Shopkeeper-...-Small.jpg` or `edd/2020/08/...-Large.jpg` |
| Dimensions/sizes | `wp_postmeta._wp_attachment_metadata` (attachment) | Serialized: `{width, height, file, filesize, sizes:{...}, image_meta:{...}}`. **`filesize` is absent on all sampled attachments** (0/3,000) — do not rely on it. |
| Alt text | `wp_postmeta._wp_attachment_image_alt` (attachment) | 89,847 rows — good coverage |
| Canonical URL | `wp_posts.guid` on the attachment | 90,324 point at `https://creativehatti.test`, 7 at a stale `pwnkmr.wpengine.com` host |

### Attachment profile

- 90,331 total. MIME: `image/jpeg` 90,146 · `image/png` 136 · `image/webp` 44 · `image/svg+xml` 3 · `image/gif` 1 · `application/zip` 1
- Parents: `download` 44,963 · `post` 300 · `page` 115
- Upload layout: standard `YYYY/MM` for product media, plus a dedicated `edd/YYYY/MM` tree used for the large previews
  - `edd/` breakdown: 2020 → 390, 2021 → 11,410, 2022 → 14,836, 2023 → 15,928, 2024 → 2,409, 2025 → 1
  - Non-`edd/` media: 2021 → 11,410 in `/2021/`, etc. Total `uploads/` ≈ 9.4 GB (`edd` = 7.4 GB)

### Generated image sizes (from `_wp_attachment_metadata.sizes`)

**WordPress core:** `thumbnail` (150×150), `medium` (300×max), `medium_large` (768×max), `large` (1024×max), `1536x1536` (13 attachments), `2048x2048` (6).

**EDD Software Licensing:** `sl-small` (128×128), `sl-large` (256×256). Present on ~400/400 sampled product thumbs.

**Mayosis (legacy theme) — the watermark/grid set:**
| Size | Sample dims | Coverage in 400-product thumb sample |
|---|---|---|
| `mayosis-product-thumb-small` | 170×170 | 400 |
| `mayosis-product-grid-small` | 150×100 | 400 |
| `mayosis-product-wave-small` | 90×90 | 400 |
| `mayosis-grid-small` | 300×225 / 300×300 | 211 |
| `mayosis-grid-list` | 150×100 | 123 |
| `mayosis-single-page-thumbnail` | 720×480 | 2 |
| `mayosis-product-carousel` | 592×665 | 2 |

`edd_settings` configures `edd_img_wtm_*_img = /2021/08/WaterMark-1.png` with `repeated_on_image = 1` for most of these — **the watermark is composited into the generated files on disk.** Those `mayosis-*` variants are therefore *not* clean sources for a new frontend.

**Third-party (JEG, one-off):** `jeg-120x96`, `jeg-360x180`, `jeg-360x480`, `jeg-360x540`, `jeg-370x296`, `jeg-370x370`, `jeg-90x90`, `jeg-featured-750`, `jeg-750x536`, `jeg-800x400`, `jeg-1140x570`, `jeg-featured-1140` — all on 1–4 attachments.

### What to expose to Next.js

**Recommended image DTO per product:**

```json
"images": {
  "featured": { "id": 12974, "url": "<guid>", "width": 400, "height": 300, "alt": "..." },
  "gallery":  [ { "id": 12975, "url": "<guid>", "width": 512, "height": 512, "alt": "..." } ],
  "sources":  { "small": "<_thumbnail_id guid>", "large": "<vdw_gallery_id[0] guid>" }
}
```

Guidance:
- **Yes — return the original (`guid`) URL of the featured and gallery attachments.** The featured image is already the 400px "small" asset; the gallery entry is the "medium"/large preview. This is the pair the old site actually displayed.
- **Yes — return `width` / `height` from `_wp_attachment_metadata`** so Next.js `<Image>` can reserve layout space.
- **Yes — return `_wp_attachment_image_alt`** (89,847 rows, well populated and valuable for SEO/accessibility).
- **No — do not return Mayosis `*-small` / `*-grid-*` / `mayosis-wave-small` variants to the public frontend.** They are watermarked composites, heavily duplicated, and lower resolution than the originals in most cases.
- **No — do not return `sl-small` / `sl-large`** to public consumers (they exist for SL's own UI; harmless but noise).
- **No — do not return `_wp_attached_file` raw paths** to the frontend. Expose absolute URLs only.
- **Consider returning `medium` (300px) and `thumbnail` (150px)** for list/grid views where the 400px featured asset is still too heavy. `medium` exists on ~all sampled thumbs; `thumbnail` on ~all.
- Optionally expose `medium_large` (768px) as an explicit `zoom` field for a lightbox. Coverage is patchy (5/400 in the thumb sample), so treat it as best-effort.
- `filesize` is unavailable in `_wp_attachment_metadata` — do not return a byte size for images.

---

## 8. Download / S3 Architecture

### How files are stored

`wp_postmeta` key **`edd_download_files`**, present on 44,800 products, PHP-serialized as an array indexed from 1:

```php
[
  1 => [
    'index'          => '0',
    'attachment_id'  => '0',                                   // always 0 (except 1 anomaly)
    'thumbnail_size' => 'Clever Indian Shopkeeper Vector Bundle Illustrations (16 Units).zip',
    'name'           => 'Clever Indian Shopkeeper Vector Bundle Illustrations (16 Units).zip',
    'file'           => 'creativehattidotcom/Clever Indian Shopkeeper Vector Bundle Illustrations (16 Units).zip',
    'condition'      => 'all',                                 // 'all' or a price_id
  ],
]
```

Key-set frequency over 3,000 sampled products:
| Key set | Count |
|---|---|
| `index + attachment_id + thumbnail_size + name + file + condition` | 2,993 |
| `index + attachment_id + thumbnail_size + name + file` (no `condition`) | 6 |
| anything containing a **`type`** key | **0** |

Files-per-product: `{1: 2998, 2: 2}`.

`file` value shape over 8,000 sampled products:
| Shape | Count |
|---|---|
| `bucket/object.key` (bucket-prefixed path) | 7,997 |
| bare filename (no slash) | 1 |
| full `http(s)://` URL | 1 |
| empty | 0 |

First path segment: **`creativehattidotcom` on 7,997 of 8,000** files. So the stored value is `<bucket>/<object key>` with **no nesting** — object keys are flat filenames at the bucket root:

```
storage_type: s3
bucket: [REDACTED — value stored in wp_options.edd_settings.edd_amazon_s3_bucket]
host: s3.amazonaws.com
object_key_structure: <Product Name> (NN).zip      # flat, at bucket root, spaces preserved
access: presigned URL, generated on demand
```

(The single `https://` entry starts with `https:` as its first path segment — a legacy external URL.)

### How S3 is resolved

`edd-amazon-s3` 2.3.13 hooks into EDD at:

| Filter | Callback | Effect |
|---|---|---|
| `edd_requested_file` | `generate_url( $file, $download_files, $file_key )` | **Replaces the file path with a presigned S3 URL at request time** |
| `edd_requested_file_name` | `requested_file_name()` | Strips pre-1.4 `AWSAccessKeyId=…` query strings from legacy stored values |
| `edd_file_download_method` | `set_download_method()` | Forces `redirect` |
| `cfm_file_download_url` | `file_download_url()` | Same presigning for Carbon Forms uploads |
| `fes_pre_files_save`, `fes_load_fields_array`, `edd_s3_upload` | — | Admin upload path to S3 |

S3-detection heuristic (`EDD_Amazon_S3::is_s3_file()`): a file counts as S3 if it does **not** begin with `/` and contains no `http://`, `https://`, or `ftp://` — or if it contains `AWSAccessKeyId`. Since every `file` value here is `creativehattidotcom/…`, **100% of product files resolve as S3**, and EDD never sees a local path.

Presigned URL generation (`get_s3_url( $filename, $expires = 5 )`):
1. Split on `/`; first segment is the bucket. If it isn't in the account's bucket list, fall back to the configured bucket.
2. Strip the bucket prefix from the key.
3. `str_replace( '+', ' ', $filename )` — keys contain literal spaces.
4. `$this->s3->createPresignedRequest( GetObject, '+N minutes' )`; N comes from `edd_amazon_s3_default_expiry` = **1440 minutes (24 h)**.

Credentials live in `wp_options` → `edd_settings`: `edd_amazon_s3_id` (AWS access key ID — **present, not printed**), `edd_amazon_s3_key` (AWS secret — **present, not printed**), `edd_amazon_s3_bucket`, `edd_amazon_s3_host`, `edd_amazon_s3_default_expiry`.

### Is storage mixed?

**Yes, and this matters.**

- **S3 (authoritative for product files):** every `edd_download_files[].file` value.
- **Local disk:** `wp-content/uploads/edd/` contains **80,704 files / ~7.4 GB** across 2020–2025, plus the full `YYYY/MM` media tree (~2 GB). These are the **image** assets (product previews/thumbnails) plus historical residue. Attachment `guid` values all point at `https://creativehatti.test`, and the media folder has already been copied per the brief.
- `_edd_free_downloads_file` — present on 34,150 products but **`""` on all 34,150**. This is an inert free-download hook, not a second file store.
- `edd_download_files[].attachment_id` is `0` everywhere (except one anomaly where a filename string landed in that field), so **no file is backed by a WP attachment**. Files and media are two disjoint systems.

### What the custom API needs to generate a secure download

The safe pattern is to **delegate to EDD**, not to mint S3 URLs directly. EDD already enforces: token validation, order status, refund revocation, per-price-option file entitlement, and download limits.

**Recommended design**

1. Authenticate the request (WP user session / Application Password / a Next.js-held token) and resolve `customer_id` via `edd_get_customer_by( 'user_id', $wp_user_id )` **or** `edd_get_customer_by( 'email', $email )` for guests.
2. Verify ownership:
   ```php
   $entitled = edd_order_grants_access_to_download_files( array(
       'order_id'   => $order_id,
       'product_id' => $download_id,
       'price_id'   => $price_id,   // null for the 99.97% of products
       'file_key'   => $file_key,   // null to accept any file
   ) );
   ```
3. Enforce limits: `edd_is_file_at_download_limit( $download_id, $order_id, $file_key, $price_id )` (currently a no-op: no `_edd_download_limit` meta and no global `file_download_limit`).
4. Log the download: `edd_record_download_in_log( $download_id, $file_key, [], $ip, $order_id, $price_id )` so `wp_edd_logs_file_downloads` stays authoritative.
5. **Return a short-lived signed EDD URL, not an S3 URL.** Two options:
   - **(a) Preferred — proxy/redirect through EDD:** build the standard `?edd_action=download_file&download={id}&file={key}&price_id={pid}&order_key={order.payment_key}&email={order.email}&expire={ts}` URL. EDD validates it, records the log, and the `edd-amazon-s3` plugin presigns the S3 URL server-side. No AWS credential ever leaves WordPress.
   - **(b) Generate the presigned URL server-side** via `edd_amazon_s3()->get_s3_url( $file_value, 5 )` with a 5-minute expiry. This is what the plugin already does; it works but duplicates entitlement logic and leaks the bucket name to the client.
6. **Never expose** `edd_download_files[].file` (which contains the bucket name) to an unauthenticated caller.

**Data the API must read internally but must not return:**
- `edd_amazon_s3_id`, `edd_amazon_s3_key`, bucket, host, expiry
- `wp_edd_orders.payment_key` (the download-signing key)
- `wp_edd_licenses.license_key`
- `wp_edd_orders.email`, `ip`
- `wp_edd_logs_file_downloads.ip`, `user_agent`

---

## 9. Customer Architecture

### Primary identifier

**`wp_edd_customers.id` is the canonical customer ID.** Every EDD order, license, and file-download log references it. `wp_users.ID` is only an optional attachment.

### `wp_edd_customers` schema

```
id               bigint        PK  auto_increment
user_id          bigint        MUL  default 0        -> wp_users.ID, 0 for guests
email            varchar(50)   UNIQUE                <- PRIMARY identity (unique index)
name             mediumtext
status           varchar(20)   MUL  default 'active'
purchase_value   mediumtext                          <- denormalized, unreliable
purchase_count   bigint
date_created     datetime      MUL
date_modified    datetime
uuid             varchar(100)                        <- only partly populated
payment_ids      longtext                           <- serialized list, legacy
notes            longtext
INDEXES: PRIMARY(id), UNIQUE(email), user(user_id), status, date_created
```

> ⚠️ **`email` is only `varchar(50)`.** That is tight for modern addresses and is a schema-level constraint to be aware of when the new frontend collects emails. It is also the unique key, so identity resolution by email is safe.

### Aggregate profile

| Metric | Value |
|---|---|
| Total EDD customers | **6,265** |
| Linked to a WP user (`user_id > 0`) | **1,578** |
| **Guest customers (`user_id = 0`)** | **4,687 (74.9%)** |
| Status `active` / `disabled` | 6,265 / 0 |
| Empty `email` | 0 |
| Customers with a UUID | partial (early rows only) |
| `user_id > 0` where the WP user row exists | 1,578 / 1,578 — no dangling links |
| Duplicate `email` in customers | **0** |
| Customers whose `email` differs from their WP user's `user_email` | 7 |
| Customers with `user_id = 0` but a WP user of the same email exists | **0** |
| `purchase_count` sane | **No** — sample values included `178`, `68`, `35`, `0` alongside `purchase_value` of `2`, `13.00`, `9.99`. The `purchase_value` column holds unparseable/varying-format data (`mediumtext` with mixed plain and decimal strings). **Do not surface either field.** |

### `wp_users`

- 6,095 users, all with role `subscriber` except 4 `shop_manager`, 2 `administrator`, 1 `author`
- **4,519 WP users have no EDD customer record** — most are the 4 uploader accounts plus newsletter/app signups
- ⇒ `wp_users` is not a customer list; it is an account list with heavy overlap in email but not in ID

### `wp_edd_customer_email_addresses` (EDD 3.x, partially adopted)

```
id, customer_id, type ('primary'|'secondary'), status, email, date_created, date_modified, uuid
```

- 5,754 `primary` / 8 `secondary`, all `active`
- **5,755 of 5,762 rows match `wp_edd_customers.email`** ⇒ the table mirrors the denormalised column and adds almost nothing
- Only **6 customers** have more than one email row
- **1,068 rows** match a `wp_users.user_email` — i.e. the extra-emails table is the only structured place where a customer has several addresses
- This table was adopted only partially by this site; `wp_edd_customer_addresses` is **completely empty (0 rows)** and `wp_edd_order_addresses` is **empty (0 rows)** — no address data is stored at all

### `wp_edd_customermeta`

4 rows only, single key `additional_email` (4). Effectively unused.

### Anonymised customer examples

```
id=1    user_id=1     email_sha256=b26d0f93…8653  name="R" (len 12)  status=active  purchase_count=178  date=2020-06-18
id=2    user_id=1078  email_sha256=59b8e316…c250  name="N" (len 11)  status=active  purchase_count=68   date=2020-06-26
id=3    user_id=6     email_sha256=fb683e3a…7b7b  name="P" (len 11)  status=active  purchase_count=35   date=2020-06-26
id=4    user_id=0     email_sha256=d986fe54…0e20  name="J" (len 14)  status=active  purchase_count=3    date=2020-06-26  <- GUEST
id=5    user_id=678   email_sha256=8df205f4…6b03  name="M" (len 11)  status=active  purchase_count=22   date=2020-06-29
id=6    user_id=549   email_sha256=5b973a1a…de0  name="R" (len 12)  status=active  purchase_count=0    date=2020-08-10
```

No real emails, names, addresses, or phone numbers appear anywhere in this report.

### Identity resolution for the new API

| Situation | Resolution |
|---|---|
| Logged-in WP user with purchases | `edd_get_customer_by( 'user_id', get_current_user_id() )` — works for 1,578 customers |
| Logged-in WP user with **no** EDD customer | Treat as a zero-purchase account; do **not** create a customer record on read |
| **Guest buyer (74.9% of customers)** | Authenticate by email: `edd_get_customer_by( 'email', $email )` and send a magic link / OTP. Do not assume a WP user exists. |
| Guest buyer who later registers | 0 such cases exist today (`user_id=0` + matching WP user = 0), so **there is no established linking flow** — this is a design decision, not an existing mechanism. |

---

## 10. Order Architecture

### EDD 3.x tables (all present, EDD 3.7.1 era)

| Table | Rows | Purpose |
|---|---|---|
| `wp_edd_orders` | **17,007** | Order headers |
| `wp_edd_order_items` | **18,817** | Line items |
| `wp_edd_ordermeta` | 11,848 | Order meta |
| `wp_edd_order_itemmeta` | **0** | Empty |
| `wp_edd_order_adjustments` | 883 | Discount adjustments (all `type=discount`, `object_type=order`) |
| `wp_edd_order_adjustmentmeta` | 0 | Empty |
| `wp_edd_order_addresses` | **0** | Empty |
| `wp_edd_order_transactions` | **0** | Empty |

### `wp_edd_orders` — the relationships that matter

```
id              bigint        PK
parent          bigint        MUL  default 0        -> self-ref; 0 rows use it (no partial refunds recorded as child orders)
order_number    varchar(255)  MUL
status          varchar(20)   MUL  default 'pending'
type            varchar(20)   default 'sale'        -> all rows are 'sale' (no 'refund' type orders)
user_id         bigint        MUL  default 0        -> wp_users.ID, 0 for guests
customer_id     bigint        MUL  default 0        -> wp_edd_customers.id
email           varchar(100)  MUL
ip              varchar(60)
gateway         varchar(100)  default 'manual'
mode            varchar(20)   default 'live'
currency        varchar(20)   MUL
payment_key     varchar(64)   MUL                  <- used to sign download URLs
subtotal, discount, tax, total   decimal(18,9)
rate            decimal(10,5)
date_created, date_modified, date_completed, date_refundable, date_actions_run  datetime
uuid            varchar(100)
INDEXES: PRIMARY(id), order_number, status_type(status,type), user_id, customer_id,
         email, payment_key, date_created_completed(date_created,date_completed),
         currency, parent_type(parent,type)
```

### `wp_edd_order_items`

```
id            bigint        PK
parent        bigint        MUL  default 0
order_id      bigint        MUL  default 0        -> wp_edd_orders.id
product_id    bigint                         -> wp_posts.ID of a `download`
product_name  text                             <- DENORMALISED title snapshot
price_id      bigint        NULL                -> NULL on 18,814 / 18,817 rows
cart_index    bigint
type          varchar(20)   MUL  default 'download'   -> all rows 'download'
status        varchar(20)   default 'pending'
quantity      int           default 0
amount, subtotal, discount, tax, total   decimal(18,9)
INDEXES: PRIMARY(id), order_product_price_id(order_id, product_id, price_id),
         type_status(type,status), parent(parent)
```

> **`order_product_price_id (order_id, product_id, price_id)` is exactly the index an ownership lookup needs.** This is the key structural asset for the entitlements API.

### Aggregate profile

| Metric | Value |
|---|---|
| Orders | 17,007 |
| `status = complete` | 16,626 |
| `status = abandoned` | 373 |
| `status = failed` | 6 |
| `status = pending` | 2 |
| `type` | 100% `sale` (no `refund` orders, `parent` unused) |
| Date range | 2020-06-18 → 2026-08-10 |
| With `customer_id > 0` | 16,231 (95.4%) |
| **With neither user nor customer (`0`/`0`)** | **776** — all `manual` gateway, all `complete`, all with order items. Only 1 of their emails matches an EDD customer. **These are unattributable purchases.** |
| With `user_id > 0` | 4,733 (27.8%) |
| **Guest orders (`user_id = 0`, customer present)** | **11,498**, of which 11,490 complete, across 4,710 distinct customers |
| Currency | INR 17,006 · USD 1 |
| Mode | live 17,007 |

Gateways: `manual` 15,992 (94%) · `razorpay` 971 · `paypal` 32 · `paypal_commerce` 10 · `paytm` 2.

> **The 94% `manual` gateway rate is a data-quality red flag.** It means historical "orders" were largely created by hand in wp-admin (bulk imports, migrated data, or admin-granted purchases). Treat historical order data as *indicative* rather than *authoritative* for revenue reporting, though it is still the only entitlement source.

### Order items

| Metric | Value |
|---|---|
| Items by status | `complete` 18,177 · `abandoned` 624 · `pending` 10 · `failed` 6 |
| **Distinct products ever sold** | **3,158** (of 44,792 published — only 7.0%) |
| Max items for one product | 340 (`sidhu-moose-wala-…`, #30701) |
| `price_id` non-null | **3** |
| `product_id` pointing at a deleted post | **49 rows / ~20+ distinct IDs** (e.g. 372, 375, 413, 416, 429, 435, 439, 442, 916, 941, 1301, 1656, 1712, 2038, 2115, 2158 …) — orphan purchases that a `GET /customer/orders` endpoint must tolerate |
| Top sellers | #30701 (340×) · #109059 (248×) · #109066 (242×) · #11617 Narendra Modi (239×) · #31813 Jawaharlal Nehru (195×) |

### `wp_edd_ordermeta` (only 9 keys, all infrastructure)

`_edd_complete_actions_run` (10,692 orders) · `_edd_payment_acquisition_method` (563) · `payment_meta` (163) · `_edd_jilt_cart_token` (124) · `_edd_should_send_admin_order_notice` (113) · `_edd_should_send_order_receipt` (112) · `_edd_jilt_marketing_consent_offered` (78) · `_mc_subscribed` (2) · `paypal_order_id` (1).

⇒ **There is no `edd_order_meta` store of business data.** No addresses, no custom fields, no coupon snapshots. Order information lives entirely in `wp_edd_orders` + `wp_edd_order_items` + `wp_edd_order_adjustments`.

### `wp_edd_order_adjustments`

883 rows, all `type = discount`, `object_type = order`, no `type_id`. Descriptions are short codes. Adjustments are linked by `(object_id, object_type)` — resolve with `edd_get_order_adjustments()`.

### ⚠️ Legacy EDD 2.x residue — must be understood before any migration

| Table | Rows | Note |
|---|---|---|
| `wp_posts` where `post_type = edd_payment` | 17,178 | **EDD 2.x payments**, meta on each: `_edd_payment_meta`, `_edd_payment_gateway`, `_edd_payment_user_id`, `_edd_payment_user_ip`, `_edd_payment_purchase_key`, `_edd_payment_customer_id`, `_edd_payment_total`, `_edd_payment_tax`, `_edd_payment_user_email` (17,131), `_edd_completed_date` (16,512), `_edd_complete_actions_run` (14,044), `_edd_payment_mode` (3,512), `_edd_payment_tax_rate` (3,512) |
| `wp_posts` where `post_type = edd_log` | 41,160 | **EDD 2.x logs**, `edd_log_type` taxonomy: `sale` 18,073 · `file_download` 18,666 · `api_request` 5,039 · `gateway_error` 9. Date range 2020-10-05 → 2024-09-17 |
| `wp_edd_notes` | 44,993 | Order notes (13.1 MB) |
| `wp_edd_logs_emails` | 2,425 | Email log |
| `wp_edd_logs_api_requests` | 5,039 | API log |

**The `edd_payment` posts are not a duplicate of `wp_edd_orders`** — they are the pre-migration history. `edd_payment` posts end 2024-09-17 while `edd_orders` continue to 2026-08-10, and the two have different counts. EDD 3.x reads orders from `wp_edd_orders`; the 2.x posts are effectively dead weight that the new API should ignore. **They are also the only place `_edd_payment_purchase_key` lives**, so do not attempt to reconstruct modern download links from them.

### How to get customer → orders → products → downloads

**Preferred (official APIs):**
```php
$customer = edd_get_customer( $customer_id );                  // or edd_get_customer_by( 'user_id'|'email', … )
$orders   = edd_get_orders( array(
    'customer_id' => $customer->id,
    'status'      => edd_get_deliverable_order_item_statuses(), // 'complete' here
    'number'      => 20, 'offset' => 0, 'orderby' => 'date', 'order' => 'DESC',
) );
foreach ( $orders as $order ) {
    $items = edd_get_order_items( array( 'order_id' => $order->id, 'number' => 0 ) );
    foreach ( $items as $item ) {
        $product_id = $item->product_id;
        $price_id   = $item->price_id;
    }
}
```
`edd_get_orders()`, `edd_get_order()`, `edd_get_order_items()`, `edd_get_order_adjustments()` are the supported query layer and all filter through the composite indexes above.

**Direct SQL equivalent** (for reference only, not for the plugin):
```sql
SELECT o.id, o.order_number, o.status, o.date_completed, o.currency, o.total,
       oi.id AS item_id, oi.product_id, oi.price_id, oi.quantity, oi.amount
FROM   wp_edd_orders      o  JOIN wp_edd_order_items oi ON oi.order_id = o.id
WHERE  o.customer_id = ?
  AND  o.status = 'complete'
  AND  oi.status = 'complete'
  AND  oi.quantity > 0
ORDER  BY o.date_completed DESC;
```

---

## 11. Download Entitlements

### Question 1 — "Does customer X own product Y?"

**Preferred:**
```php
$order_items = edd_get_order_items( array(
    'number'            => 0,      // all
    'customer_id'       => $customer_id,   // EDD 3.x supports filtering by customer
    'product_id'        => $product_id,
    'status'            => edd_get_deliverable_order_item_statuses(),
    'quantity__compare' => array( 'value' => 0, 'compare' => '>' ),
) );
$owns = (bool) $order_items;
```
`edd_get_deliverable_order_item_statuses()` returns `['complete']` for this install (18,177 of 18,817 items).

**Exact SQL** (validated against the available index):
```sql
SELECT 1
FROM   wp_edd_orders      o
JOIN   wp_edd_order_items oi ON oi.order_id = o.id
WHERE  o.customer_id = :customer_id
  AND  oi.product_id  = :product_id
  AND  o.status       = 'complete'
  AND  oi.status      = 'complete'
  AND  oi.quantity    >  0
LIMIT 1;
```
Backed by `wp_edd_order_items.order_product_price_id (order_id, product_id, price_id)`, and `wp_edd_orders.customer_id`. **Caveat:** this single query does not filter on order status in the index, so a 6,000-row customer profile (see the demo below) touches a few thousand index rows. Still cheap.

**Gotchas found in the data**
1. **`price_id` matters only for 3 order items** in the whole database. For 44,768 of 44,801 products `price_id` is `NULL` on both the product and the purchase, so a `price_id`-agnostic match is correct 99.98% of the time — but `EDD\Downloads\Entitlement::withholds_file()` is the correct guard if you want strictness.
2. **49 order items reference deleted products.** A `GET /customer/orders` must return them with a placeholder rather than crash or 500.
3. **776 completed orders have no customer** and therefore cannot be attributed to any customer. They will be invisible in customer-scoped endpoints. This is expected, not a bug to fix.
4. **Free products generate real order items.** 101 published products have `edd_price = 0`, but they account for **2,898 completed order items**. A "purchase" of a free product is still an order, and must still grant download entitlement.

### Question 2 — "What files is customer X allowed to download?"

Three-step resolution:

1. **Find the granting order(s):** as above, with `order_id` and `price_id` retained.
2. **Enforce limits:** `edd_is_file_at_download_limit( $download_id, $order_id, $file_key, $price_id )` (`download-functions.php:1112`). Currently a no-op — no `_edd_download_limit` meta and no global `file_download_limit` setting — but call it anyway so limits work if they are ever set.
3. **Get the entitled file list:**
   - Whole product file list: `edd_get_download_files( $download_id )` → `EDD_Download::get_files()` (trait `EDD\Downloads\Traits\Files`).
   - Price-option-scoped (only matters for the 33 variable-priced products): `( new EDD\Downloads\Entitlement( $download_id, $price_id ) )->get_files()`, or `EDD_Download::get_files_for_price_id( $price_id )` (3.7.1+).
   - Each file entry's `condition` is `'all'` for essentially every file, so `filter_files_by_condition()` is a no-op in practice.

**File-level access is the authoritative gate** — `edd_order_grants_access_to_download_files()` (`process-download.php:1010`) is what EDD itself calls before serving a byte, and it additionally rejects `type = 'refund'` orders (none exist here).

### Download limits and expiration

| Control | Value |
|---|---|
| Global file download limit (`edd_settings.file_download_limit`) | **Not set** → `0` = unlimited |
| Per-product `_edd_download_limit` | **0 rows** — never used |
| `download_link_expiration` | 24 hours |
| `edd_amazon_s3_default_expiry` | 1440 minutes = 24 hours (presigned URL TTL) |
| `require_login_to_download` (`edd_get_option('require_login_to_download')`) | `false` in `edd_settings`; but `logged_in_only = 1` and the free-downloads setting `vp_edd_fd_must_log_in = 1` (a Mayosis-era EDD File Download plugin setting) also exist. **Verify actual behaviour before relying on either.** |
| Product-level `edd_sl_exp_length` + `_edd_sl_exp_unit` | 2,505 products: `1 day` (615) / `1 year` (607) / empty (1,890). `_edd_sl_exp_unit` = `days` 44,193 / `years` 607. **This is SL licensing expiry, not download expiry.** |

### Download log

`wp_edd_logs_file_downloads`:
```
id, product_id, file_id, order_id, price_id, customer_id, ip, user_agent, date_created, date_modified, uuid
INDEXES: PRIMARY(id), customer_id, product_id, date_created
```

| Metric | Value |
|---|---|
| Rows | 18,596 |
| Distinct customers | 5,571 |
| Distinct products | 3,074 |
| Distinct orders | 15,595 |
| With `order_id = 0` | **782** (free downloads without an order context) |
| Date range | 2020-08-09 → 2026-08-10 |
| `wp_edd_logs_file_downloadmeta` | 668 rows, single key `file_name` (plain filename, not a path — safe-ish, but not needed) |

Anonymised worked example — the highest-volume customer (`customer_id = 3248`):

```
complete orders: 264
recent order -> item rows:
  order 151093  complete  sale  manual  2022-11-25  item 12499  product 10019  complete  qty 1  price_id NULL
  order 151090  complete  sale  manual  2022-11-25  item 12498  product  3507  complete  qty 1  price_id NULL
  order 151087  complete  sale  manual  2022-11-25  item 12497  product  3516  complete  qty 1  price_id NULL
distinct products owned:      252
file-download log rows:        264
licenses:                      262
```

Product 10019's file resolves to:
```
edd_download_files[1]:
  name  = <product name>.zip
  file  = <bucket>/<product name>.zip        # S3 object key
  condition = all
```

### Free downloads

`edd_free_downloads_on_complete = auto-download` and `easy-digital-downloads-free-link` only changes the button label (`edd_free_link_label = Download`). The `_edd_free_downloads_file` meta is empty on all 34,150 products, so **there is no separate "free link" path** — free products follow the exact same entitlement flow as paid ones (order → order item → file).

### Verified end-to-end path (single query, real data)

```
wp_edd_orders.customer_id  ──┐
                            ├──> wp_edd_order_items (order_id, product_id, price_id, status, quantity)
wp_posts.ID (download)  ────┘                 │
                                              ├──> wp_postmeta.edd_download_files  (the S3 object key)
                                              ├──> wp_edd_logs_file_downloads      (audit / limit counting)
                                              └──> wp_edd_licenses                 (optional SL key)
```

---

## 12. Software Licensing

**EDD Software Licensing 3.8.8** is installed and active.

### Tables

| Table | Rows | Notes |
|---|---|---|
| `wp_edd_licenses` | **17,828** | `PRIMARY(id)`; indexes on `license_key`, `download_id_and_price_id(download_id, price_id)`, `customer_id_status(customer_id, status)`, `payment_id_and_parent(payment_id, parent)`, `parent` |
| `wp_edd_licensemeta` | **0** | Completely empty |
| `wp_edd_license_activations` | **0** | Completely empty |
| `wp_posts` (`post_type = edd_license_log`) | 1 | |
| `wp_edd_notes` | 44,993 | shared with orders |

### `wp_edd_licenses` schema

```
id           bigint         PK
license_key  varchar(255)   MUL      <- 32-char keys; NEVER expose
status       varchar(20)              <- 'inactive' | 'expired' (and 'active' when activated)
download_id  bigint         MUL      -> wp_posts.ID of the licensed `download`
price_id     varchar(20)    NULL
payment_id   bigint         MUL      -> order that generated it
cart_index   bigint
date_created datetime
expiration   bigint         NULL     <- Unix timestamp, 0 = never
parent       varchar(20)    MUL      <- '0' for all rows (no upgrade-chain hierarchy in use)
customer_id  varchar(20)    MUL      -> wp_edd_customers.id (varchar, not FK)
user_id      varchar(20)              -> wp_users.ID, often '0'
```

### Aggregate profile (no keys printed)

| Metric | Value |
|---|---|
| Total licenses | 17,828 |
| `status = inactive` | **17,665 (99.1%)** |
| `status = expired` | 163 |
| `status = active` | **0** |
| Distinct licensed products | 3,462 |
| Distinct license customers | 5,868 |
| Distinct `payment_id` | 16,203 |
| `expiration > 0` | 180 |
| `expiration = 0` (never) | 17,648 |
| Licenses whose `download_id` no longer exists | **11** |
| Activations | **0** |
| Licensemeta rows | **0** |
| `payment_id` matches an `wp_edd_orders` row | 17,271 |
| `payment_id` matches an `edd_payment` post | 17,309 |
| `payment_id` matches an order item for the same `download_id` | 17,270 |

**Architecture is clean, operation is dormant.** Keys were generated at purchase (`_cl_key_template` is a mask on 8 products), stored, and never activated. This means:

- The **key generation and storage path works** — 17,828 keys exist and link correctly to orders and customers.
- The **activation path has never been exercised** — 0 activation rows means the `wp_edd_license_activations` schema, status transitions (`inactive → active`), and expiry logic have **not been validated at scale in this install**.
- A `GET /customer/licenses` endpoint is therefore straightforward to build (read `wp_edd_licenses WHERE customer_id = ?`), but any *activation* feature is greenfield and should be treated as new development with real risk.

### Relationship map

```
wp_edd_customers.id ──> wp_edd_licenses.customer_id
wp_posts.ID (download) ──> wp_edd_licenses.download_id
wp_edd_orders.id ──> wp_edd_licenses.payment_id
wp_edd_licenses.id ──> wp_edd_license_activations.license_id   (0 rows today)
```

`customer_id` and `user_id` are `varchar(20)` columns, not typed FKs — cast carefully.

### Never expose

`license_key`, `wp_edd_licenses.id` combined with a purchase key, or any `licensemeta` (empty, but keep the rule).

---

## 13. Wishlists

**EDD Wish Lists 1.1.10** is installed and active.

### Storage

| Aspect | Detail |
|---|---|
| Post type | `edd_wish_list`, registered in `includes/post-type.php:50` with `public => true`, `show_ui => true`, `capability_type => post`, `rewrite => false` |
| Item payload | **Single postmeta row** `edd_wish_list`, PHP-serialized |
| Item structure | `a:N:{ i:0; a:3:{ s:2:"id"; s:N:"<download_id>"; s:7:"options"; a:0:{} s:8:"quantity"; i:1; } }` |
| Ownership | **`wp_posts.post_author`** = the WP user ID |
| Taxonomy terms | **None** — 0 `term_relationships` for this post type |
| Extra tables | **None** — no dedicated wishlist table |

All read/write goes through `get_post_meta( $list_id, 'edd_wish_list', true )` (see `includes/functions.php:104`, `includes/wish-list-functions.php:19/32/55/97`, `includes/metabox.php:37`, `includes/ajax-functions.php:80`, `includes/template-functions.php:49`).

### Data profile

| Metric | Value |
|---|---|
| Wishlist posts | **354** (309 `private`, 45 `publish`) |
| Date range | 2020-07-22 → 2026-09-25 |
| With `post_author = 0` | 0 |
| `post_author` resolves to a real `wp_users` row | **354 / 354 (100%)** |
| Wishlists with items | 304 (11 are empty) |
| **Total items across all wishlists** | **485** |
| Items pointing at a non-`download` post | 1 of 485 |

Items per wishlist: `{0: 11, 1: 256, 2: 26, 3: 7, 4: 5, 6: 1, 7: 2, 8: 2, 11: 1, 12: 2, 32: 1, 33: 1}`

The 32- and 33-item lists are almost certainly test/QA accounts, not real users.

### Can the old wishlist data be retained?

**Yes, trivially.** 354 rows and 485 items is nothing. The structure is a simple `(post_author, list of download_ids)` relation:

```sql
SELECT p.post_author AS wp_user_id, item.*
FROM   wp_posts p
JOIN   wp_postmeta m ON m.post_id = p.ID AND m.meta_key = 'edd_wish_list'
WHERE  p.post_type = 'edd_wish_list'
```

Retention caveats:
1. **Guest wishlists are not supported by the data.** All 354 lists have a real `post_author`. `edd_settings.edd_wl_allow_guests = yes`, but no guest lists exist, so the guest path is untested here.
2. **Ownership is by WP user, not EDD customer.** A wishlist created by a WP user with no purchases is perfectly valid and would need to survive independently of `wp_edd_customers`.
3. **The item's `options` array is always empty** in every sampled row, so no price-option selections need migrating.
4. **1 orphan item** references a post that is no longer a `download`.

**Recommendation: preserve as-is.** Export `(post_author → [download_ids])` during any migration and re-implement wishlist writes in the new plugin using the same post type and meta key, so the EDD Wish Lists extension (and its admin UI) keeps working. Do not migrate to a new table.

---

## 14. Legacy Mayosis / Plugin Dependencies

### A. MUST PRESERVE (business-critical)

| Data | Source | Why |
|---|---|---|
| Product title, slug, body, status, dates | `wp_posts` (`download`) | The catalogue itself |
| Price | `wp_postmeta.edd_price` | Commerce |
| Variable price options | `wp_postmeta.edd_variable_prices` + `_edd_default_price_id` | 33 products still sell this way |
| **Download files (S3 object keys)** | `wp_postmeta.edd_download_files` | **The actual deliverable. Losing this loses the business.** |
| S3 bucket + credentials + expiry | `wp_options.edd_settings` (`edd_amazon_s3_*`) | Without it nothing is downloadable |
| Product categories | `download_category` taxonomy | Navigation |
| Product tags | `download_tag` taxonomy | Discovery, related products, SEO |
| Customers | `wp_edd_customers` (+ `wp_users`) | Identity |
| Orders + items | `wp_edd_orders`, `wp_edd_order_items`, `wp_edd_order_adjustments` | **The only entitlement source** |
| Licenses | `wp_edd_licenses` | Issued keys owed to customers |
| Discounts | `download`/`edd_discount` posts + 15 `_edd_discount_*` meta keys | 9 discounts, 2 active |
| Featured image attachments + `wp-content/uploads` | `wp_posts` (attachment) + files on disk | The storefront |
| Gallery attachments | `vdw_gallery_id` | Every product's large preview image |
| Purchase limits | `_edd_purchase_limit` (669 products) | Stock control on 669 products |
| Wishlists | `edd_wish_list` posts + `edd_wish_list` meta | 485 user selections |
| `edd_sr_version` / `edd_sr_version_limit` / `edd_sr_batch_max` | postmeta | Vestigial but 11,206 / 1,459 products carry them; decide before dropping |

### B. MAY PRESERVE (valuable, not critical)

| Data | Source | Note |
|---|---|---|
| `file_type`, `file_size`, `compatible_with`, `documentation` | postmeta (44,800 each) | Real merchandising attributes; cheap to expose |
| Featured flag | `edd_feature_download` (28 products) | A curated homepage set — almost certainly needs re-selection anyway |
| Sales counters | `_edd_download_sales`, `_edd_download_gross_sales` | Denormalized; 1,030 products disagree between net and gross. Prefer computing from order items. |
| File download log | `wp_edd_logs_file_downloads` (18,596) | Useful for support, abuse detection, limit analytics |
| Order notes | `wp_edd_notes` (44,993) | Historical support context |
| Category term meta | `category_image_main`, `additional_description` | 27 categories have real data |
| Category descriptions | `wp_term_taxonomy.description` | Only 2 categories have any |
| SL product config | `_edd_sl_*` (mostly inert) | 43,806 products flagged enabled but no activations exist |
| Excluded orders | 776 unattributable `manual` orders | Archive, never delete |
| Orphan order items | 49 items → deleted products | Archive |
| Orphan licenses | 11 licenses → deleted products | Archive |
| `_yoast_wpseo_metadesc` / `_yoast_wpseo_title` | postmeta (44,797 / 44,798) | Already-written SEO copy worth migrating to the new frontend |
| Currency rates | `eddcurrency` posts (28) | INR base; a currency selector existed |
| `hits` | postmeta (41) | Popularity counter |

### C. FRONTEND-ONLY / CAN REMOVE LATER (do not delete now)

| Data | Source | Volume |
|---|---|---|
| WPBakery state | `_wpb_vc_js_status` | 44,800 rows, all `false` |
| WPBakery custom CSS | `_wpb_post_custom_css`, `_wpb_shortcodes_custom_css` | 3 rows |
| Mayosis image size registrations | `edd_settings.edd_img_wtm_mayosis-*` | ~14 option keys |
| Mayosis-generated image variants | `_wp_attachment_metadata.sizes['mayosis-*']` | On thousands of attachments, watermarked |
| GridPlus grid definitions | `grid_plus*` options (hundreds), `wp_eg_*` tables (1 grid, 5 item skins, 15 nav skins), `post_grid` / `vc_grid_item` posts | Layout only |
| Mayosis licence option | `Mayosis_lic_Key` (empty) | 1 row |
| Page templates | `_wp_page_template` on downloads (all `default`), `prime-download-template.php`, `full-width-download-template.php`, `dasboard-extended.php`, `sitemap.php` | 5 real templates |
| Yoast computed scores | `_yoast_wpseo_content_score`, `_yoast_wpseo_linkdex`, `_yoast_wpseo_focuskeywords`, `_yoast_wpseo_keywordsynonyms`, `_yoast_wpseo_estimated-reading-time-minutes` | 5 keys × ~45 K = ~225 K rows of pure noise |
| Editor locks | `_edit_lock`, `_edit_last` | 89,602 rows |
| Old dates/slugs | `_wp_old_date` (12,056 products / 12,453 rows), `_wp_old_slug` (340 / 392) | Redirects worth keeping for SEO |
| Search index residue | `wp_asp_index` (4.6 M rows, **1.0 GB**), `wp_searchwp_index` (610 K rows, 137 MB), `wp_ajaxsearchpro_*` (7 tables) | ~1.2 GB of orphaned data |
| WPMDB queue | `_mig_queue_jobs` (814,522 rows, **917 MB**), `_mig_wpmdb_alter_statements`, `_mig_queue_failures` | ~917 MB orphaned |
| Legacy EDD 2.x | `edd_payment` posts (17,178), `edd_log` posts (41,160), `wp_edd_logs_emails` (2,425), `wp_edd_logs_api_requests` (5,039) | ~64 K rows |
| `eddcurrency` posts | 28 | If currency switching is not needed |
| Dead third-party metas | `_siq_post_*` (4,509), `ac_*` (9), `somdn_dlcount` (2), `webpushr_*` (2), `wpp_*` (3), `_dp_*` (39), `_cl_key_template` (8), `product_changelog` (3), `size_of_image` (2), `select_custom_template` (2) | ~4,600 rows |
| Zeroed legacy settings | `_edd_free_downloads_file` (34,150 rows, all `""`), `_edd_bundled_products` (11,934, mostly `["0"]`) | ~46 K rows |

> **Total reclaimable: roughly 2.2 GB** (ASP 1.0 GB + SearchWP 137 MB + WPMDB 917 MB, plus ~150 MB of postmeta). None of it should be deleted until the new frontend is live and verified.

### D. UNKNOWN / NEEDS DECISION

| Item | Why it's open |
|---|---|
| **`file_type` / `file_size` / `compatible_with` / `documentation`** | Real values, but their semantics came from the Mayosis template. Confirm they should become first-class DTO fields before committing the API shape. |
| **`product_version`** | Empty on 44,798/44,800 but the two non-empty values (`3.20 MB`, `CS6, CS6+`) look like misplaced `file_size` / `compatible_with` data. Data-entry accident, not a real field. |
| **The 9,277 `_yoast_wpseo_focuskeywords` / `_keywordsynonyms` rows** | Value is literally `[""]` — corrupted or unused. Cannot tell if real keyword data was lost. |
| **44,733 empty `post_excerpt` values** | Two contain a Razorpay transaction ID (i.e. they were used as a scratch field at some point). The other 44,731 are simply unused. |
| **9 duplicate titles among published products** | Harmless but means titles are not a unique key. |
| **`download_tag` quality** | 3.4 M relationships, 24,720 terms, `creative hatti` + `creativehatti` duplicates, scraped admin-table tags. Needs a curation decision before it can power a tag-based Next.js UI. |
| **`_edd_bundled_products`** | 11,934 products carry `["0"]`. 1 product (`202649`) carries `{"1":""}`. Real bundle behaviour is essentially unused, but 11,934 rows exist. |
| **`edd_sr_*` (Software Recurring)** | The extension is not installed but 11,206 products carry version metadata. Was there a subscription product line that was retired? |
| **The 7,379 products with zero sales** | 44,792 published, only 3,158 ever sold. Are unpublished/retired products expected to stay public? |
| **Mayosis EDD File Download pages** | Pages 3401 (`download`), 2426 (`member`), 3627 (`files`) plus settings `vp_edd_fd_*` and `edd_free_downloads_*` refer to a plugin not on disk. The `logged_in_only`/`require_login` download behaviour may be partly governed by dead code. |
| **AWS credential rotation** | `edd_amazon_s3_id` / `edd_amazon_s3_key` are long-lived IAM credentials sitting in `wp_options` in plaintext. Worth rotating into an IAM role before the new API is built. |
| **`wp_edd_customers.purchase_value` / `purchase_count`** | Denormalized and internally inconsistent (see §9). If revenue reporting is ever needed, recompute from `wp_edd_order_items`. |
| **94% `manual` gateway** | 15,992 of 17,007 orders. Whether these represent real revenue, migrated data, or admin grants is unknown and materially affects any financial reconciliation. |

---

## 15. Data We Must Preserve

Consolidated, prioritised for the migration:

**Tier 1 — the business (cannot be regenerated)**
1. `wp_edd_download_files` (44,800 products) — the S3 object keys. **Single point of failure.**
2. S3 credentials/bucket/expiry in `wp_options.edd_settings`
3. `wp_edd_orders` + `wp_edd_order_items` (17,007 + 18,817) — entitlements
4. `wp_edd_customers` (6,265) + `wp_users` (6,095) — identity
5. `wp_edd_licenses` (17,828) — issued keys owed to customers
6. `wp-content/uploads/edd/` (~7.4 GB) + the `YYYY/MM` media tree (~2 GB) — images
7. `download_category` (35 terms, 73,660 links) + `download_tag` (24,720 terms, 3.4 M links)

**Tier 2 — the catalogue**
8. `wp_posts` where `post_type='download'` (44,801)
9. `edd_price`, `edd_variable_prices`, `_edd_default_price_id`
10. `wp_posts` where `post_type='attachment'` (90,331) + `_wp_attached_file` + `_wp_attachment_metadata` + `_wp_attachment_image_alt`
11. `vdw_gallery_id` (44,799 products)
12. `file_type`, `file_size`, `compatible_with`, `documentation` (44,800 each)
13. `edd_discount` posts + `_edd_discount_*` meta (9 discounts)
14. `_edd_purchase_limit` (669 products)
15. `edd_wish_list` posts + `edd_wish_list` meta (354 / 485 items)

**Tier 3 — operational history**
16. `wp_edd_logs_file_downloads` (18,596), `wp_edd_notes` (44,993), `wp_edd_customer_email_addresses` (5,762)
17. `_wp_old_slug` / `_wp_old_date` (redirect preservation)
18. `_yoast_wpseo_title` / `_yoast_wpseo_metadesc` (already-written SEO copy)

---

## 16. Data We Can Eventually Remove

**High value, low risk, ~2.2 GB:**

| Table / key | Size | Why safe |
|---|---|---|
| `_mig_queue_jobs` + `_mig_queue_failures` + `_mig_wpmdb_alter_statements` | **~917 MB** | WPMDB migration queue; `wp-migrate-db-pro` is installed but no migration is running. Orphaned. |
| `wp_asp_index` | **~1.0 GB** | Ajax Search Pro index. **The plugin is not installed.** 4.6 M orphaned rows. |
| `wp_searchwp_index`, `wp_searchwp_log`, `wp_searchwp_status`, `wp_searchwp_tokens` | **~137 MB** | SearchWP index. **The plugin is not installed.** |
| `wp_ajaxsearchpro*` (7 tables) | ~5 MB | Same |
| `wp_posts` where `post_type='edd_payment'` (17,178) | ~50 MB | EDD 2.x payments, superseded by `wp_edd_orders`, last activity 2024-09-17 |
| `wp_posts` where `post_type='edd_log'` (41,160) | ~60 MB | EDD 2.x logs; `wp_edd_logs_*` tables supersede them |
| `_yoast_wpseo_content_score`, `_yoast_wpseo_linkdex`, `_yoast_wpseo_focuskeywords`, `_yoast_wpseo_keywordsynonyms`, `_yoast_wpseo_estimated-reading-time-minutes` | ~225 K rows | Computed analytics, no business value |
| `_edit_lock`, `_edit_last` | 89,602 rows | Editor session state |
| `_wpb_vc_js_status` (44,800, all `false`) | 44,800 rows | WPBakery; the theme is gone |
| `_edd_free_downloads_file` (34,150, all `""`) | 34,150 rows | Inert |
| Mayosis `*-small` / `mayosis-*` generated image files | ~1 GB on disk | Watermarked composites; regenerate or ignore |
| `grid_plus*` options, `wp_eg_*` tables, `post_grid` / `vc_grid_item` posts | small | Layout definitions for a removed theme |
| `Mayosis_lic_Key` (empty), `eddcurrency` posts (28) | small | If currency switching is retired |
| `_siq_post_*` (4,509), `ac_*`, `somdn_dlcount`, `webpushr_*`, `wpp_*`, `_dp_*`, `_cl_key_template`, `product_changelog` | ~4,600 rows | Dead plugins |

**Constraint:** *do not delete any of this yet.* This is a plan, not an action. Clean it only after the Next.js frontend is live and verified against the real data.

---

## 17. Proposed Creative Hatti API

Namespace: `/wp-json/ch/v1/`. Implemented as `wp-content/plugins/creative-hatti-api/`. **Not built yet — this is a design recommendation.**

### v1 — public read (no auth)

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/products` | Cursor-paginated list. Query params: `page`, `per_page` (max 48), `category` (slug, repeatable), `tag` (slug, repeatable), `featured`, `free`, `min_price`, `max_price`, `sort` (`newest\|oldest\|popular\|price_asc\|price_desc\|title`), `search`. Default `sort=newest`. |
| GET | `/products/{id}` | Full DTO. Accepts numeric ID. |
| GET | `/products/slug/{slug}` | Full DTO by `post_name`. |
| GET | `/categories` | Flat list of `download_category` terms with product counts, parent IDs, image (`category_image_main`), description. Query: `parent`, `include_children`. |
| GET | `/categories/{slug}` | One category + its children + breadcrumb path. |
| GET | `/tags` | **Optional** — 24,720 terms is too many to ship as one list. Require `search`, `min_count`, or `limit`. |
| GET | `/search` | `q`, `type=product|category`, `limit`. |
| GET | `/meta/filters` | Aggregate price range, available formats, compatibility list, top tags — for building filter UIs without N requests. |

**Route ordering note:** register `/products/slug/(?P<slug>[\w\-]+)` **before** `/products/(?P<id>\d+)` or the numeric route will not shadow it (a slug that is all digits would be ambiguous).

### v1 — authenticated read

Authentication: **WordPress Application Passwords** over HTTPS (already supported in WP 7.1.2; `using_application_passwords` option is present) or a short-lived JWT issued by a login endpoint. Resolve identity with `edd_get_customer_by( 'user_id', … )` then fall back to `edd_get_customer_by( 'email', … )` for guests.

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/customer/me` | EDD customer DTO: id, name, email, status, `has_account` (bool), purchase counts. **No IP, no notes, no payment_ids.** |
| GET | `/customer/orders` | Cursor-paginated. Each order: number, status, dates, currency, totals, items (product id/slug/title snapshot, quantity, amount, price_id), adjustments. Tolerate the 49 orphan items and the 1 USD order. |
| GET | `/customer/downloads` | Per purchased product: entitled files, per-file download count, limit status, and a **server-minted signed EDD download URL** (see §8). Never return `edd_download_files[].file`. |
| GET | `/customer/wishlist` | All wishlists for `post_author = current user`, with items. |
| GET | `/customer/licenses` | `status`, `product`, `created`, `expires` — **never the key itself**, unless the endpoint is specifically `/customer/licenses/{id}/reveal` behind a stronger check. |

### Future transactional

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/cart` | Server-side EDD cart (`edd_set_cart_details` / `EDD_Cart`), returns cart id + totals. |
| POST | `/checkout` | `edd_get_purchase_data` / `edd_purchase_form_data`, returns a checkout token. |
| POST | `/payment/create` | Creates the gateway order. For Razorpay: `razorpay_create_order`. |
| POST | `/payment/verify` | Validates the signature and calls `edd_complete_purchase()`. |
| POST | `/customer/wishlist` | Add/remove, preserving the `edd_wish_list` post type and meta key so the EDD extension stays compatible. |

### Cross-cutting rules

1. **No raw postmeta ever crosses the boundary.** Every response is built from a named DTO class. Meta keys are read server-side and mapped to explicit fields.
2. **Rate-limit and authenticate `/customer/*`** and `/payment/*`; cache `/products*` publicly.
3. **Version under the namespace** (`/ch/v1/…`) so a breaking change ships as `/ch/v2/…`.
4. **Return `meta.total`, `meta.per_page`, `meta.has_more`** plus a `next_cursor` for stable cursor pagination.
5. **Sanitise `post_content`** — 44,801 products contain raw HTML with inline `<span style>` from the old editor. Either sanitise with `wp_kses_post()` and hand over a sanitised HTML string, or strip to text and let Next.js render structured blocks. Decide explicitly; do not pass through untouched.
6. **Never leak** `wp_edd_customers.email` of a third party, `order.ip`, `logs.ip`, `logs.user_agent`, `orders.payment_key`, `licenses.license_key`, or any S3/AWS value.

---

## 18. Recommended Product DTO

### List DTO (for `/products`, `/search` — keep small)

```json
{
  "id": 2499,
  "slug": "seth-motumal-the-clever-shopkeeper-vector-bundle",
  "title": "Seth Motumal - The Clever Shopkeeper Vector Bundle",
  "status": "publish",
  "price": { "amount": 3999.00, "currency": "INR", "formatted": "₹3,999" },
  "isFree": false,
  "isVariablePrice": false,
  "featured": true,
  "categories": [
    { "id": 49,  "slug": "character-bundles", "name": "Character Bundles" },
    { "id": 3857, "slug": "profession",       "name": "Profession", "parent": 49 }
  ],
  "images": {
    "featured": {
      "id": 12974,
      "url": "https://creativehatti.test/wp-content/uploads/2021/02/Indian-Shopkeeper-Vector-Bundle-Set-Thumbnail-Small.jpg",
      "width": 400, "height": 300,
      "alt": "Indian-Shopkeeper-Vector-Bundle-Set-Thumbnail-Small",
      "sizes": { "thumbnail": "…-150x150.jpg", "medium": "…-300x225.jpg" }
    },
    "gallery": [
      { "id": 12975, "url": "https://creativehatti.test/wp-content/uploads/edd/2021/02/Indian-Shopkeeper-Vector-Bundle-Set-Thumbnail-Medium.jpg", "width": 512, "height": 512, "alt": "…" }
    ]
  },
  "fileSummary": { "count": 1, "types": ["EPS", "PNG"], "sizeLabel": "6.08 MB", "compatibility": ["Adobe Illustrator"] },
  "salesCount": 7,
  "publishedAt": "2021-02-08T11:20:49+05:30",
  "modifiedAt":  "2021-09-17T17:10:38+05:30"
}
```

### Detail DTO (for `/products/{id}` and `/products/slug/{slug}`)

List DTO **plus**:

```json
{
  "descriptionHtml": "<h2>Seth Motumal - The Clever Shopkeeper</h2>…",
  "descriptionText": "Seth Motumal - The Clever Shopkeeper …",
  "excerpt": "Meet Seth Motumal, a money-minded and clever shopkeeper…",
  "attributes": {
    "fileTypes": ["EPS", "PNG"],
    "fileSizeLabel": "6.08 MB",
    "compatibility": ["Adobe Illustrator"],
    "documentationIncluded": true
  },
  "variations": null,
  "files": [
    {
      "key": 1,
      "name": "Clever Indian Shopkeeper Vector Bundle Illustrations (16 Units).zip",
      "type": "zip",
      "sizeBytes": null,
      "condition": "all",
      "storage": "s3"
    }
  ],
  "tags": [ { "id": 103, "slug": "creative-hatti", "name": "creative hatti" } ],
  "seo": {
    "title": "Seth Motumal - The Clever Shopkeeper Vector Bundle on Creative Hatti",
    "metaDescription": "Meet Seth Motumal, a money-minded and clever shopkeeper who spends hours in scheming things to make more money."
  },
  "licensing": {
    "enabled": true,
    "activationLimit": 0,
    "version": null,
    "expiry": { "length": 1, "unit": "days" }
  },
  "limits": {
    "purchaseLimit": null,
    "purchaseLimitVariableDisabled": false,
    "downloadLimit": null
  },
  "bundle": null,
  "entry": {
    "wpAuthorId": 7,
    "previousSlugs": ["seth-motumal-the-clever-shopkeeper"],
    "previousDates": ["2020-07-21", "2020-08-08", "2020-08-29"]
  }
}
```

### Field mapping (all 92 meta keys accounted for)

| DTO field | Source | API/method | Preserve? |
|---|---|---|---|
| `id` | `wp_posts.ID` | `get_post()` / `EDD_Download::get_ID()` | YES |
| `slug` | `wp_posts.post_name` | `get_post_field('post_name')` | YES |
| `title` | `wp_posts.post_title` | `get_the_title()` | YES |
| `descriptionHtml` | `wp_posts.post_content` | `wp_kses_post()` | YES |
| `descriptionText` | `wp_posts.post_content` | `wp_strip_all_tags()` | YES |
| `excerpt` | `wp_posts.post_excerpt` | `get_post_field('post_excerpt')` (guard: 2 rows hold a Razorpay txn ID) | MAYBE |
| `status` | `wp_posts.post_status` | — | YES |
| `publishedAt` | `wp_posts.post_date` | — | YES |
| `modifiedAt` | `wp_posts.post_modified` | — | YES |
| `entry.wpAuthorId` | `wp_posts.post_author` | — | NO (internal) |
| `price.amount` | `wp_postmeta.edd_price` | `edd_get_download_price()` / `EDD_Download::get_price()` | YES |
| `price.currency` | `edd_settings.currency` | `edd_currency()` | YES |
| `isFree` | `edd_price` == 0 | `edd_is_free_download()` | YES |
| `variations[]` | `edd_variable_prices` | `edd_get_variable_prices()` | YES |
| `variations[].default` | `_edd_default_price_id` | `edd_get_default_variable_price()` | YES |
| `files[]` | `edd_download_files` | `edd_get_download_files()` | YES |
| `files[].storage` | derived from `file` value | `EDD_Amazon_S3::is_s3_file()` | YES |
| `salesCount` | `_edd_download_sales` | `EDD_Download::get_sales()` | YES |
| — (excluded) | `_edd_download_earnings`, `_edd_download_gross_sales`, `_edd_download_gross_earnings` | `get_earnings()` | NO |
| `images.featured` | `_thumbnail_id` | `get_post_thumbnail_id()` + `wp_get_attachment_image_src()` | YES |
| `images.gallery[]` | `vdw_gallery_id` (unserialize) + attachment `guid`/`_wp_attachment_metadata` | `wp_get_attachment_image_src()` | YES |
| `images[].alt` | `_wp_attachment_image_alt` (on attachment) | `get_post_meta()` | YES |
| `attributes.fileTypes` | `file_type` | string → array split on `,` | YES |
| `attributes.fileSizeLabel` | `file_size` | passthrough (already "6.08 MB") | YES |
| `attributes.compatibility` | `compatible_with` | string → array | YES |
| `attributes.documentationIncluded` | `documentation` | `Yes`/`YES` → bool | YES |
| `categories[]` | `download_category` | `wp_get_object_terms()` | YES |
| `tags[]` | `download_tag` | `wp_get_object_terms()` (cap + filter) | YES |
| `featured` | `edd_feature_download` | `get_post_meta() === '1'` | YES |
| `limits.purchaseLimit` | `_edd_purchase_limit` | `EDD_Purchase_Limit::get_limit()` | YES |
| `limits.purchaseLimitVariableDisabled` | `_edd_purchase_limit_variable_disable` | `get_post_meta()` | YES |
| `limits.downloadLimit` | `_edd_download_limit` (0 rows) or `edd_get_option('file_download_limit')` | `edd_get_file_download_limit()` | YES |
| `licensing.*` | `_edd_sl_*`, `edd_sl_download_lifetime` | `EDD_Software_Licensing` | YES |
| `bundle` | `_edd_bundled_products` | `EDD_Download::get_bundled_downloads()` | YES (null for 11,933) |
| `seo.*` | `_yoast_wpseo_title`, `_yoast_wpseo_metadesc` | `get_post_meta()` | MAYBE |
| `entry.previousSlugs` | `_wp_old_slug` | `get_post_meta()` | YES (redirects) |
| `entry.previousDates` | `_wp_old_date` | `get_post_meta()` | NO |
| — (excluded) | `_yoast_wpseo_content_score`, `_yoast_wpseo_linkdex`, `_yoast_wpseo_focuskw`, `_yoast_wpseo_focuskeywords`, `_yoast_wpseo_keywordsynonyms`, `_yoast_wpseo_estimated-reading-time-minutes`, `_yoast_wpseo_wordproof_timestamp`, `_yoast_wpseo_primary_download_category` | — | NO |
| — (excluded) | `_edit_lock`, `_edit_last`, `_wp_page_template`, `_wpb_vc_js_status`, `_wpb_post_custom_css`, `_wpb_shortcodes_custom_css` | — | NO |
| — (excluded) | `product_version`, `item_unique_id`, `audio_url`, `custom_link`, `custom_product_url`, `custom-button-title`, `custom-button-url`, `custom-button-description` (all empty on 44,800) | — | NO |
| — (excluded) | `video_url`, `demo_link` (always `""`/`#`) | — | MAYBE |
| — (excluded) | `_siq_post_*` (4,509), `_dp_*` (39), `ac_*` (9), `somdn_dlcount` (2), `webpushr_*`, `wpp_*`, `_cl_key_template`, `product_changelog`, `size_of_image`, `_size_of_image`, `select_custom_template`, `_select_custom_template`, `_edd_hide_purchase_link` | — | NO |
| — (excluded) | `_edd_free_downloads_file` (34,150 rows, all `""`), `_edd_free_downloads_bypass`, `_edd_bundled_products_conditions`, `_edd_price_options_mode`, `_variable_pricing`, `_cl_key_template` | — | NO |
| — (revisit) | `edd_sr_version`, `edd_sr_version_limit`, `edd_sr_batch_max` (11,206 / 11,206 / 1,459) | — | DECIDE |

**Bottom line: 25 of 92 meta keys reach the DTO. 8 are hold-for-decision. 59 are droppable.**

---

## 19. Performance Considerations

### 19.1 The tag table is the dominant risk

| Metric | Value |
|---|---|
| `wp_term_relationships` rows | 3,530,715 (~254 MB) |
| `download_tag` rows | **3,414,774 (96.7%)** |
| `download_tag` terms | 24,720 |
| Average tags per product | **76.2** |
| Max tags on one product | **134** |
| Min tags | 1 |
| Products with zero tags | 3 |

Serialising 48 products' full tag lists in a list response = **~3,650 `term_relationships` reads plus 48 × 76 = 3,648 term lookups.** The `term_relationships` index is `PRIMARY(object_id, term_taxonomy_id)` + `term_taxonomy_id`, so the object-side lookup is indexed — but the row count is what costs. This is the reason the list DTO above shows `categories` but only a capped `tags` array.

**Recommendations**
- **Never return full tag lists in a list response.** Cap at 8–12, or omit entirely and expose a separate `/products/{id}/related` endpoint.
- Add a `min_tag_count` filter so the frontend never requests the long tail.
- **Strongly consider curating tags before launch.** 24,720 terms with duplicate brand variants and scraped admin-table text is not something a new frontend should surface raw. If tags must be preserved, preserve them in the database but do not expose them unfiltered.
- `download_category` is cheap by contrast: 35 terms, 1.64 per product, 73,660 relationships total. Always return it in full.

### 19.2 postmeta

- 2,527,953 rows total (~687 MB); 1,881,554 belong to `download`; **42 rows per product on average**.
- 332,146 rows (17.7% of download postmeta) are `_yoast_wpseo_*`; 89,602 more are `_edit_lock` / `_edit_last`. **Both are pure noise the API never needs to read.**
- Indexes: `postmeta` has `meta_key` and `post_id` as **separate** single-column indexes — there is **no composite `(post_id, meta_key)`** index. A `get_post_meta( $id, $key, true )` therefore resolves the key first, then filters by `post_id` across all rows with that key. For a 24-key-per-product read on 48 products this is 48 × 24 = 1,152 index dives into a 2.5 M-row table.
- **Mitigation — the single most impactful optimisation:** build the list DTO with **one** bulk `SELECT post_id, meta_key, meta_value FROM wp_postmeta WHERE post_id IN (...) AND meta_key IN (...)` (24 keys × 48 IDs) instead of 1,152 individual lookups. That is 1 query instead of 1,152. `WP_Query` with `update_post_meta_cache()` / `update_post_term_cache()` does this for core fields but not for arbitrary meta — a custom `WP_Query` + `prime_post_caches()` plus a hand-rolled meta prime is the way.
- Consider `wp_cache_prime()` / a persistent object cache (Redis or Memcached) for hot products. There is **no persistent object cache configured** today (`breeze_version 2.4.6` and `perfmatters_version 1.5.7` options exist, but no `object_cache` drop-in and no Redis/Memcached option).

### 19.3 `WP_Query` scalability

- `wp_posts` = 206,455 rows / ~149 MB. Indexes: `type_status_date(post_type, post_status, post_date, ID)`, `post_name`, `post_parent`, `post_author`, `type_status_author`. **All good** — a category-filtered, date-ordered product query is index-friendly.
- The dangerous part is `tax_query` against `download_tag`. A `tax_query` on tags produces `object_id IN (... thousands ...)`, which is where the 3.4 M rows bite. **Restrict tag filtering to `min_count`-filtered terms, or use `fields => ids` and a hard cap.**
- Products with zero categories: 4. Zero tags: 3. Either way, an inner `tax_query` will exclude them — decide if that is acceptable (probably yes).

### 19.4 Search

**Current state is a mess and needs a decision:**

| Engine | Index table | Size | Plugin installed? |
|---|---|---|---|
| Ajax Search Pro 4.26.2 | `wp_asp_index` (4,636,346 rows) + `wp_ajaxsearchpro*` | **~1.0 GB** | **NO** |
| SearchWP 4.1.21 | `wp_searchwp_index` (610,461 rows) | **~137 MB** | **NO** |
| Relevanssi | — | — | NO |
| Core `WP_Query` search | — | — | Yes (default) |
| WooCommerce/EDD search tables | — | — | No |

`edd_settings` still holds ASP/SearchWP residue (`_siq_engine_name = www.creativehatti.com`, `_siq_post_types_for_search = download,siq_pdf`, `_asp_version`, `asp_version = 5011`, `searchwp_version = 4.1.21`). Both plugins are absent from disk, so **all of that index data is dead weight and search is currently falling back to MySQL `LIKE` against `post_title` / `post_content`.**

**Recommendations**
1. **v1 search: use MySQL.** 44,792 published products with an index on `post_name` and `type_status_date` is fine for `LIKE '%term%'` on titles at moderate latency. Add an `EXPLAIN` check before launch.
2. **Do not try to revive ASP or SearchWP.** Both would need re-installation, re-indexing, and a licence.
3. **If search quality matters (it does for a 44 K catalogue), a separate index is the right long-term answer:** Meilisearch, Typesense, Elasticsearch, or Algolia. This is also the natural place to solve the tag-bloat problem — index only curated tags.
4. **Before any of that, decide whether to delete the two orphaned index tables** and reclaim ~1.15 GB. That is a data-modification step, out of scope for this audit.

### 19.5 Image retrieval

- 90,331 attachments, `image/jpeg` dominant (90,146). Product thumbs are already 400–512 px — appropriate for a modern card grid.
- `wp_get_attachment_image_src()` does not hit the filesystem (it reads `_wp_attachment_metadata`), so **URL generation is cheap** — the cost is the 90,331-row `wp_posts` type+status index plus the `postmeta` reads.
- Use `update_postmeta_cache()` on the attachment IDs in one batch.
- **Serve images from a CDN or Next.js image optimiser**, not from PHP. Do not proxy image bytes through the WordPress REST API.
- `_wp_attachment_metadata.filesize` is **absent on all sampled attachments** — you cannot report image byte sizes from the DB. If Next.js needs byte sizes, get them from the filesystem once and store them, or drop the field.

### 19.6 Pagination

**Do not use `OFFSET`.** At 44,792 products, `OFFSET 40000` makes the database walk and discard 40,000 index entries. Two viable strategies:

| Strategy | Approach | Trade-off |
|---|---|---|
| **Cursor (recommended)** | Add a stable secondary sort. Best available: `ID DESC` (unique, indexed via `type_status_date`'s trailing `ID`). Encode `{last_id, last_sort_value}` in an opaque base64 cursor. | Loses "jump to page 50"; needs the filter signature in the cursor. |
| Keyset on `post_date` | `WHERE (post_date, ID) < (:d, :i)` | `post_date` collides heavily (thousands of products share a date) — must always pair with `ID`. |
| Offset (avoid) | `paged=N` | Simple, but degrades linearly. Acceptable only for admin screens and shallow pages. |

Cap `per_page` at 24–48. Return `meta.total` (a `COUNT(DISTINCT)` — consider caching it, it is not free) plus `meta.has_more` / `next_cursor`. A cheaper `has_more` is `SELECT 1 … LIMIT 1 OFFSET per_page`, which avoids the total count entirely.

### 19.7 N+1 risks to guard against

| N+1 | Why it happens | Fix |
|---|---|---|
| Categories per product | `wp_get_object_terms()` per product | `update_post_term_cache()` in the query loop — WP does this automatically for `tax_query` hits |
| Tags per product | Same, but 76× worse | Cap the count; use a `fields => names` query |
| Featured image per product | `get_the_post_thumbnail()` per product | `update_post_caches()` + one batched `wp_get_attachment_metadata()` read |
| Gallery per product | `vdw_gallery_id` unserialised + an attachment query per product | Batch: collect all attachment IDs, one `WP_Query` on all of them, then map back |
| Postmeta per product | 42 keys × N products | **One** `IN (...)` query for all needed keys |
| Price per product | `EDD_Download` object per product | Instantiate once, or read the batched meta directly and skip the object graph |
| Sales per product | `_edd_download_sales` — already in the meta batch | — |

**Target: ≤ 6 SQL queries for a 48-product list response** (1 posts + 1 meta + 1 term_relationships + 1 terms + 1 attachments + 1 attachment meta).

### 19.8 Caching strategy

| Layer | Recommendation |
|---|---|
| **Persistent object cache** | **Yes — add Redis or Memcached.** No drop-in is present today. Biggest single win: 1,152 meta lookups per page become dictionary reads. |
| **REST response cache** | **Yes for public read endpoints.** `GET /products`, `/categories` are highly cacheable. Cache key = route + sorted query args + a generation counter bumped when a product is saved (`update_post_meta` → bump a global version in `wp_options`). Respect `Cache-Control` / `ETag`; make responses stale-while-revalidate. |
| **Never cache** | `/customer/*`, `/payment/*`, and any response containing a signed download URL. |
| **Signed download URLs** | TTL is 24 h in the S3 plugin. Consider minting 5-minute URLs for the API surface instead, and never cache the response containing them. |
| **`WP_Query` transients** | Consider `wp_cache_*` with a namespace for hot products and category listings. |
| **Term/tag data** | Cache the term→product-count map aggressively; it is stable and expensive to recompute. |
| **ETag / Last-Modified** | Implement on `/products/{id}` using `post_modified` (max of the product's `post_modified` and its attachment `post_modified`). Cheap and effective. |

### 19.9 Should a separate search/indexing system be used?

**Eventually yes, but not in v1.**

| Stage | Approach | Why |
|---|---|---|
| v1 (launch) | MySQL `LIKE` on `post_title` + `post_content`; category/tag filters via `tax_query` | Zero new infrastructure. Adequate for 44,792 products at moderate query volume. |
| v1.1 | Add a persistent object cache + response caching | Cheap, high leverage, no new services |
| v2 | **Meilisearch or Typesense** (single binary, self-hosted, excellent typo tolerance) | Solves search quality, gives instant faceting on price/format/category, and lets you **index only curated tags** — sidestepping the 3.4 M-row tag problem entirely. Sync via a WP-Cron/webhook on `save_post`. |
| v3 (optional) | Algolia or Elasticsearch | Only if scale/languages demand it |

If a separate index is adopted, the API should read **from the index for search and listing**, and **from WordPress for single-product detail and everything customer-related**. Never put customer or order data into a third-party index.

### 19.10 Other performance notes

- `wp_edd_notes` is 44,993 rows / 13.1 MB. Do not load notes in any customer-facing endpoint.
- `wp_edd_logs_api_requests` (5,039) and `wp_edd_logs_emails` (2,425) are irrelevant to the API.
- `wp_edd_customer_email_addresses` (5,762 / 2.4 MB) and `wp_edd_orders` (17,007 / 12.1 MB) are small; index-supported access is fine.
- 9 draft products and 2 pending orders exist — default to `status = publish` on all public queries and require an explicit `include_drafts` flag (admin-only) otherwise.
- 3 products have no `_thumbnail_id` and 4 have empty `edd_download_files` — the DTO must return `null` / empty arrays, not throw.

---

## 20. Risks / Unknowns

### High

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | **`edd_download_files` is the sole record of every deliverable.** One bad migration destroys the ability to deliver any product. | Catastrophic | Export `post_id, name, file, condition` to a versioned CSV/JSONL **before any migration**. Verify row count (44,800) and that every `file` value starts with the bucket prefix. |
| 2 | **Long-lived AWS IAM credentials in plaintext `wp_options`.** | Credential compromise | Rotate to an IAM role / scoped key with read-only `GetObject` on that one bucket prefix. Store outside `wp_options`. Do before the API ships. |
| 3 | **3.4 M `download_tag` relationships (76 per product).** | Slow or unusable list endpoints | Cap tags in the DTO; curate terms; index only curated tags in v2. |
| 4 | **74.9% of customers are guests (`user_id = 0`); 11,498 guest orders.** | Auth design that assumes WP users fails for 3 of every 4 customers | Design `/customer/*` around email + magic link from day one. `edd_get_customer_by( 'email', … )` is the fallback path. |
| 5 | **`wp_edd_customers.email` is `varchar(50)`.** | Emails longer than 50 chars would be truncated by strict mode — potential identity collisions. | Audit the current max email length before launch. Plan a column widening **before** the new frontend starts accepting registrations. |
| 6 | **94% of orders are `manual` gateway.** | Historical revenue and entitlement data may not reflect real transactions. | Reconcile a sample against Razorpay/PayPal. Do not build financial reporting on `purchase_value` / `purchase_count`. |

### Medium

| # | Risk | Mitigation |
|---|---|---|
| 7 | 49 order items and 11 licenses point at deleted products. | `GET /customer/orders` must return placeholders. Do not join blindly to `wp_posts`. |
| 8 | 776 completed orders have no customer. | Expected. They will be invisible in customer endpoints. Archive, never delete. |
| 9 | 3 products have empty `edd_download_files`; 369 have no `edd_price`. | DTO returns `files: []` and `price.amount: 0` / `null` rather than erroring. |
| 10 | Newer products (post-2023) are missing `_edd_free_downloads_file`, `_edd_sl_enabled`, `compatible_with`, `documentation`. | Never assume a meta key exists. Use `??` defaults everywhere. |
| 11 | One product's `edd_download_files[].attachment_id` holds a filename string instead of `0`. | Sanity-check `attachment_id` with `is_numeric()` before use. |
| 12 | SL is 99% inactive with 0 activations. Activation logic is untested. | `GET /customer/licenses` is safe. Any activation feature is new development. |
| 13 | `_edd_download_limit` never used, global `file_download_limit` unset ⇒ unlimited. | If the new frontend implies limits, they must be set deliberately. |
| 14 | `require_login_to_download` is `false` in settings but `logged_in_only = 1` and a dead Mayosis FD plugin set `vp_edd_fd_must_log_in = 1`. Conflicting signals. | **Verify actual runtime download behaviour** before designing the download UX. |
| 15 | WordPress 7.1.2 + EDD 3.7.1 + PHP 8.3.33 is a current, supported stack — but `wp-migrate-db-pro`, `easy-digital-downloads-free-link`, and `razorpay-edd-2.1.0` have no version headers. | Confirm maintenance posture. The free-link and Razorpay plugins are the ones to watch. |
| 16 | Next.js image optimisation of 90,331 images will be heavy on first run. | Pre-warm the top ~5,000 product images; lazy-load the rest. |
| 17 | 9 published products share a duplicate title. | Never key anything by title. |

### Low / informational

| # | Risk | Note |
|---|---|---|
| 18 | 7 attachments have stale `pwnkmr.wpengine.com` GUIDs. | Build media URLs from the site URL + `_wp_attached_file`, not from `guid`. |
| 19 | 1 `application/zip` attachment. | Cosmetic. |
| 20 | 2 product excerpts contain a Razorpay transaction ID. | Never expose `post_excerpt` unfiltered. |
| 21 | `_wp_attachment_metadata.filesize` absent everywhere. | Cannot report image byte sizes from the DB. |
| 22 | 44,733 empty excerpts, 1 empty slug, 1 empty content. | Tolerant DTO required. |
| 23 | `eddcurrency` post type and ~20 exchange-rate settings remain from a removed currency-switcher. | Remove only after confirming the new frontend does not need multi-currency. |

### Explicitly out of scope for this audit

Per the brief, **nothing was modified**. No `UPDATE` / `DELETE` / `INSERT` / `ALTER` / `DROP` / `TRUNCATE` / `REPLACE` / `OPTIMIZE` / migration command was run. No file was edited, renamed, or deleted. No plugin was activated, deactivated, or installed. `wp-config.php` was read programmatically for DB credentials only; **no credential value appears in this report**. No metadata was cleaned. The `creative-hatti-api` plugin was **not** created.

---

## 21. Recommended Next Development Step

**Phase 1 of the API plugin — a read-only catalogue slice, delivered behind a feature flag.**

Concretely:

1. **Back up first (highest priority, before anything else).** Export a versioned, checksummed snapshot of:
   - `wp_postmeta` rows for `meta_key='edd_download_files'` on `download` posts (post_id, name, file, condition) — **44,800 rows**
   - `wp_edd_orders` + `wp_edd_order_items` + `wp_edd_customers` + `wp_edd_licenses`
   - `wp_terms` / `wp_term_taxonomy` / `wp_term_relationships` for `download_category` and `download_tag`
   Verify row counts against the numbers in this report.

2. **Scaffold `wp-content/plugins/creative-hatti-api/`** with:
   - Namespace `CH_API`, REST base `ch/v1`
   - A `CH_API_Product_Repository` class that owns **all** DB access
   - A `CH_API_Product_DTO` class that maps meta → JSON (the mapping table in §18 is the spec)
   - A `CH_API_Schema` class with the response envelope (`data`, `meta.total`, `meta.has_more`, `next_cursor`)
   - No global state, no direct `get_post_meta()` calls from route handlers

3. **Ship exactly four endpoints:**
   - `GET /ch/v1/products` (cursor-paginated, default 24, `sort=newest`, `category` + `featured` + `free` filters, **tags capped at 10 and only when `include=tags`**)
   - `GET /ch/v1/products/{id}`
   - `GET /ch/v1/products/slug/{slug}`
   - `GET /ch/v1/categories`

4. **Enforce the N+1 budget from day one.** Instrument the list endpoint and assert **≤ 6 SQL queries** for 24 products. Add the batched meta + batched attachment + `update_post_term_cache()` strategy described in §19.7 before writing the happy path.

5. **Build a verification harness.** For 20 fixed product IDs (use the 10 sampled in §4 plus 10 more), snapshot the DTO JSON and assert byte-for-byte stability across runs. This catches accidental meta coupling before it reaches the frontend.

6. **Then, in order:**
   - `GET /ch/v1/search` (MySQL first; measure before considering Meilisearch)
   - `GET /ch/v1/categories/{slug}`
   - `GET /ch/v1/meta/filters`
   - **Authentication** (Application Passwords + guest email magic link) and the `/customer/*` endpoints
   - `GET /ch/v1/customer/downloads` with server-minted signed EDD URLs
   - Transactional endpoints (cart / checkout / Razorpay create+verify) **only after** the read path is proven

7. **Two decisions to make before the DTO is frozen:**
   - Are `file_type` / `file_size` / `compatible_with` / `documentation` promoted to first-class API fields? (Recommended: yes.)
   - Is `download_tag` curated and exposed, or hidden behind a curated allowlist? (Recommended: curate; 24,720 terms with duplicate brand variants and scraped text cannot be shown raw.)

Do **not** start with cart, checkout, or payments. The catalogue read path is 90% of the Next.js frontend's surface area and the part with the real performance risk. Get it measured, cached, and stable first.

---

*End of audit. No data was modified during this inspection.*
