# Creative Hatti — Image Orientation Metadata Audit

**Audit date:** 2026-10-31
**Environment:** Local Laragon WordPress (`creativehatti.test`) and the repository's Next.js Gallery Preview
**Scope:** Read-only inspection of published EDD product records, featured-image attachment metadata, search-index card records, API responses and Gallery Preview code. No database, plugin, image or product data was changed.

## Finding

Orientation filtering is feasible without opening image files during a search. All 44,798 products that have a featured-image reference have a valid WordPress attachment record, an attached-file path and positive original preview dimensions in `_wp_attachment_metadata`. The search index already stores the dimensions of the medium-sized card preview image in each product's `card.image` JSON.

The current indexed-search response does not expose an orientation field or accept an orientation filter. For Gallery Preview's existing search-backed pagination, the filter should be applied in indexed search before counting and paging. Filtering only the 48 products returned to the page would produce incomplete results and incorrect pagination.

## Catalogue audit

The bounded read-only database audit examined all **44,800 published products**. It read products and their featured-image references in one query, fetched referenced attachments in batches of at most 1,000 IDs, and read corresponding search-document cards. It did not scan the uploads directory or make per-product HTTP requests.

Orientation is calculated from the preview image width and height using the requested thresholds: Landscape when `width / height > 1.05`, Portrait when `< 0.95`, Square from `0.95` through `1.05` inclusive, otherwise Unknown.

| Measure | Result |
|---|---:|
| Published products examined | 44,800 |
| Products with a featured-image reference | 44,798 |
| Valid featured attachment records | 44,798 |
| Missing featured-image reference | 2 |
| Referenced attachment missing or not an attachment | 0 |
| Missing attached-file path or attachment metadata | 0 |
| Attachment metadata with missing/zero dimensions | 0 |
| Products with usable original preview dimensions | 44,798 |
| Products with search-card image URL | 44,798 |
| Search-card URLs outside local WordPress uploads | 0 |
| Search-card image dimensions missing | 2 |
| Search documents for published products | 44,800 |
| Scaled-image `original_image` metadata references | 0 |

The two products without a featured image have no search-card image dimensions and classify as Unknown. Their IDs are not part of the audit output's representative sample; they should remain visible in unfiltered results, and should not be assigned to any of the three orientation filters.

### Orientation distribution

These counts use the indexed card preview image's dimensions, matching the image Gallery Preview renders.

| Orientation | Products |
|---|---:|
| Landscape | 5,664 |
| Portrait | 1,561 |
| Square | 37,573 |
| Unknown | 2 |
| **Total** | **44,800** |

The attachment metadata orientation distribution also has 5,664 Landscape, 1,561 Portrait and 37,573 Square among the 44,798 products with featured images; Unknown is 0 for those attachments. Thus the indexed medium dimensions classify consistently with the available original attachment dimensions except for one possible medium-variant aspect-ratio discrepancy noted below.

### Representative products

Examples below are based on indexed card preview dimensions. They are examples, not additional category totals.

| Category | Representative product IDs and preview dimensions |
|---|---|
| Freebies | 2858, 3017, 3026, 3030 — each 300×300, Square |
| Diwali / festival graphics | 2926, “Diwali- Festival of Lights Vector Bundle,” 300×225, Landscape; 2947, 2959 and 2963 are also 300×225, Landscape |
| Character illustrations / bundles | 2499, 2864, 2871, 2875 and 2882 — each 300×225, Landscape |
| Banners / social media | 2981, 2987 and 3000 — each 300×200, Landscape; 3003 and 3115 are 300×300, Square |
| Logos | 15774, 15778, 15781, 15784 and 15791 — each 300×300, Square |
| Portrait artwork / templates | 2984, 2990, 2994 and 2997 — each 200×300, Portrait; 3146 is 201×300, Portrait |

## Image metadata and variants

Products use standard WordPress featured-image attachment references. The audit found valid attachment posts and positive `_wp_attachment_metadata.width` and `height` values for every referenced featured image. These values describe the public product preview image, not the downloadable ZIP/vector asset.

The indexed card image dimensions match the WordPress `medium` variant for all 44,798 available card images. There is **one aspect-ratio mismatch** between the attachment metadata and its medium variant: product **24797**, “Banner design for Surya namaskar sun salutation,” has attachment dimensions 400×97 and medium dimensions 300×73. This is a possible crop or metadata/variant discrepancy, not proof that meaningful content is cropped. It needs visual inspection only if that product's classification or appearance is disputed.

No products had dimensions available only from a thumbnail while the attachment's original dimensions were absent. The two products without featured images are the only card-dimension gaps found.

The audit deliberately did not resolve every gallery-image attachment or inspect image pixels. The local detail API exposes gallery media separately, but Gallery Preview currently uses the featured card image, not the product-detail gallery. Transparent artwork, internal whitespace, portrait subjects on square canvases and the visible subject's shape cannot be reliably inferred from file dimensions. These filters would classify **file orientation**, not visual subject orientation.

## WordPress API

The local API was checked with representative list, detail and indexed-search requests.

| Response | Image data observed | Orientation field |
|---|---|---|
| Product list (`/wp-json/ch/v1/products`) | Featured-image URL and width/height when present; sample returned 400×400 | No |
| Product detail (`/wp-json/ch/v1/products/2926`) | `featured_image` and `gallery`; featured image returned 900×675 | No |
| Indexed search (`/wp-json/ch/v1/indexed-search?q=diwali`) | Featured card image URL and dimensions; product 2926 returned 300×225 | No |

The API dimensions come from existing WordPress attachment/image-size data. Adding an optional orientation value would be backward-compatible, but adding it only to the general list/detail DTOs would not filter Gallery Preview's indexed-search result set.

## Search index

The `wp_ch_search_documents` table has one document per published product and stores the card payload as JSON. The `card.image` object includes the attachment ID, medium image URL, width, height and alt text. It does not store aspect ratio or orientation as dedicated fields. The document also does not provide an indexed orientation predicate.

The existing `wp_ch_search_facets` table has a composite key on `(kind, value, product_id)` and can represent an `orientation` facet without adding a table column or changing the table schema. The search plugin's indexing path can derive that facet from the card image's dimensions. The REST search endpoint would need to accept and apply an orientation filter as part of the database query before result count and pagination.

## Gallery Preview behavior

Gallery Preview calls the existing search service and uses the first image in each search product's `images` array. The adapter maps the indexed card's image URL and width/height into that image entry. It does not call the product-detail endpoint to get the gallery array and does not receive an orientation field before rendering.

The justified layout derives each item's aspect ratio from these image dimensions, clamps the ratio to 0.65–2.2, and uses a 1.25 fallback if dimensions are missing. It caps rows at four images and has a minimum row height of 180px. Therefore the current medium preview dimensions are already sufficient for stable row layout. Applying a server-side orientation filter should not alter the layout calculation for returned items.

## Reliability and risks

- **Strong metadata coverage:** all available featured attachments have usable dimensions, and all indexed card images have URLs and dimensions.
- **Two missing featured images:** they correctly fall into Unknown and are not silently classified as Square.
- **One possible thumbnail ratio discrepancy:** product 24797 (400×97 vs. 300×73); orientation remains Landscape under either ratio.
- **File orientation is not subject orientation:** a square canvas can contain a tall portrait subject; transparent padding and whitespace are not represented by dimensions.
- **Gallery images:** not used by this page's current card/search result path. A future change that classifies gallery images instead would need separate rules for products with mixed-orientation galleries.
- **No pixel-level crop assessment:** metadata comparison identifies one variant ratio difference, but confirming crop impact requires visual inspection; no image files were opened in this audit.

## Recommendation: Option B

WordPress has reliable dimensions and the index already carries preview dimensions, but indexed search lacks a filterable orientation field. Add an `orientation` facet derived from the indexed card image's width and height, and add an optional orientation parameter to the existing indexed-search query. This uses the current facets table and avoids filesystem work during requests.

For a specified Landscape, Portrait or Square filter, products with missing image dimensions should be excluded. In the unfiltered view, keep Unknown products visible. Do not label Unknown as Square. Preserve current category, availability, sorting and pagination behavior, and initially expose the control only on `/gallery-preview`.

### Files likely to change in a separately approved implementation

- `wordpress/creative-hatti-search/creative-hatti-search.php` — derive/store the orientation facet during indexing and constrain indexed search before counts and paging.
- `lib/services/productService.ts` and its service/search parameter types — pass the optional filter through the existing service boundary.
- `lib/creative-hatti/adapters.ts` and/or shared product/search types — only if the API response shape needs to carry orientation explicitly; the UI can instead use a typed filter parameter and need not return orientation per product.
- `app/gallery-preview/page.tsx` and Gallery Preview-specific controls/components — read and apply the filter while keeping the feature isolated from product archives.
- Focused search and Gallery Preview regression tests.

No API image DTO change is strictly required for this approach because dimensions are already in the search-card data. If a per-item orientation property is desired for display/debugging, it can be added as an optional field.

### Refresh and performance

Existing rows need an index refresh/backfill so all 44,800 product documents receive the new facet. The current index already has the required width/height values, so this is a bounded database/index operation, not an uploads scan or thumbnail rebuild. It should use the search plugin's existing batched/keyset indexing mechanism and be measured locally before being considered for production. Subsequent featured-image changes must refresh that product's orientation facet as part of the existing reindex flow.

Expected request cost is a small additional facet predicate on the existing indexed search query. The cost of the one-time local refresh depends on the configured batch size; no full-catalogue image work is required. Implementation complexity is **moderate**: one search-index facet and query parameter, service plumbing, isolated UI control, and regression coverage.

## Verification limits

This audit used bounded SQL reads and a small number of local API requests. It did not scan or hash uploads, fetch thousands of images, examine image pixels, validate gallery attachment files, or change any WordPress data. The two products without featured images and the single medium-ratio discrepancy are explicitly retained as Unknown/manual-review cases rather than “repaired.”
