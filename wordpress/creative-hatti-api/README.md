# Creative Hatti API

Custom WordPress REST API layer for the Creative Hatti Next.js frontend.

Namespace: `ch/v1`

## Razorpay test order preparation

EDD/WordPress owns Razorpay Orders API calls because it is the pricing and order authority. Configure only test credentials in the WordPress server environment, preferably in `wp-config.php` outside version control:

```php
define( 'CH_RAZORPAY_TEST_KEY_ID', getenv( 'CH_RAZORPAY_TEST_KEY_ID' ) );
define( 'CH_RAZORPAY_TEST_KEY_SECRET', getenv( 'CH_RAZORPAY_TEST_KEY_SECRET' ) );
```

The Key ID must begin with `rzp_test_`. The REST route `/ch/v1/payment/razorpay/order` accepts an EDD order ID and a short-lived checkout capability sent by the Next.js server only. It recalculates paise from EDD's stored INR total, locks per EDD order, and stores the Razorpay order ID through `edd_update_order_meta()`. Network timeouts and ambiguous provider responses are blocked as uncertain for reconciliation; they are never blindly retried. This route creates no payment, captures no funds, and never changes EDD order status or entitlements.

The Next.js checkout opens the official Razorpay Checkout.js UI with that server-created order. Its callback is sent through the capability-protected `/ch/v1/payment/razorpay/verify` route. WordPress verifies the HMAC signature, fetches payment details using the test credentials, and checks the payment ID, stored Razorpay order ID, INR amount and payment status. Only `authorized` or provider-confirmed `captured` states are recorded as EDD order metadata; an authorized payment is never represented as captured. Verification is locked per EDD order and idempotent. It does not complete EDD orders or grant downloads/licenses; fulfillment is a separate later step.

The legacy EDD Razorpay add-on remains separate. Its redirect handler requires its gateway-specific form fields (`gateway=razorpay_gateway` and `merchant_order_id`); the custom Checkout.js callback calls only the custom server route and does not send those fields or invoke the legacy gateway handler. The custom Razorpay order also uses `ch_edd_order_id` notes and never the add-on's `edd_order_id` webhook mapping key, so the add-on cannot associate a custom test order with an EDD payment.

## Historical EDD purchase limits

The API preserves `_edd_purchase_limit` as-is. Missing, blank, and zero values are unlimited; positive values cap site-wide sales across all price variations; `-1` is permanently unavailable until an administrator changes that product's metadata. Invalid negative or malformed values fail closed. Sales use `edd_get_gross_order_statuses()` and sum matching EDD sale order-item quantities, matching the historical add-on's site-wide counting rule. EDD gross statuses include refunded items, so a refund does not silently reopen a limited design; administrators must explicitly change its limit metadata to make it available again.

Limited-product purchases use MySQL per-product advisory locks shared by the custom checkout, payment preparation, EDD's standard checkout validation, and EDD's supported payment/order status-transition filters. The committed EDD pending order items are the durable reservations; repeated callbacks reuse the same order rows and do not add reservations. Custom checkout reservations expire after 48 hours only when no Razorpay order exists and no creation attempt is still creating, uncertain, or provider-created. An existing or uncertain provider attempt remains reserved after that window because it may still succeed. EDD failed/cancelled orders without authoritative closure evidence also remain reserved conservatively. A stale reservation that remains pinned requires provider reconciliation and an administrator's order action; it is not released just because time passed.

Product and indexed-search responses include `availability.available`, `availability.sold_out`, and `availability.remaining`. The storefront keeps stable product content cached and overlays availability from the bounded, `no-store` batch route below on product, archive, and search renders. Server-side cart, checkout, payment preparation, and final EDD completion checks remain authoritative and reject an oversell.

This plugin exposes catalogue data from the existing WordPress + Easy Digital Downloads database as stable frontend DTOs. It does not depend on Mayosis, WPBakery, Grid Plus, old templates, shortcodes, or raw postmeta structures.

## Architecture

Next.js -> `/wp-json/ch/v1/` -> Creative Hatti API -> WordPress + EDD -> existing database

Files:

- `creative-hatti-api.php` boots the plugin.
- `includes/class-ch-api.php` registers shared API behavior and response envelopes.
- `includes/class-ch-products-controller.php` owns product routes and query validation.
- `includes/class-ch-categories-controller.php` owns category routes.
- `includes/class-ch-product-transformer.php` translates legacy WP/EDD data to DTOs.
- `includes/class-ch-media.php` normalizes media attachments without exposing filesystem paths.
- `includes/class-ch-cache.php` is a small object-cache abstraction for later Redis/persistent cache work.

## Endpoints

### `GET /wp-json/ch/v1/products`

Public catalogue/grid endpoint. Returns product cards, not the complete product object.

Query parameters:

- `page`: integer, default `1`, minimum `1`
- `per_page`: integer, default `24`, maximum `48`
- `category`: `download_category` slug
- `orderby`: `date`, `title`, or `price`
- `order`: `asc` or `desc`
- `featured`: boolean-like value (`true`, `false`, `1`, `0`)

`popularity` ordering is intentionally omitted for now. The audit found historical sales meta, but it is not reliable enough to freeze as a frontend contract in this phase.

Response:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "per_page": 24,
    "total": 44792,
    "total_pages": 1867
  }
}
```

Product card DTO:

```json
{
  "id": 2499,
  "title": "Product Name",
  "slug": "product-name",
  "price": {
    "amount": 499,
    "formatted": "₹499",
    "currency": "INR"
  },
  "image": {
    "id": 456,
    "url": "https://creativehatti.test/wp-content/uploads/example.jpg",
    "width": 1200,
    "height": 1200,
    "alt": "Image alt"
  },
  "categories": [
    {
      "id": 10,
      "name": "Graphics",
      "slug": "graphics"
    }
  ],
  "featured": false,
  "file_type": "EPS, JPG",
  "file_size": "6.08 MB"
}
```

Tags are not returned in product list responses because this installation has millions of `download_tag` relationships.

### `GET /wp-json/ch/v1/products/availability?ids=161470,161873`

Returns current availability for up to 48 comma-separated published product IDs. The response sets `Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0` so the storefront can refresh purchase state independently of cached titles, images, prices, and descriptions. The response envelope contains `data.items`, each with `id`, `available`, `sold_out`, and `remaining`. Unknown or unpublished products are omitted; malformed or oversized ID lists return an error.

### `GET /wp-json/ch/v1/products/{id}`

Returns one published EDD product by ID.

### `GET /wp-json/ch/v1/products/slug/{slug}`

Returns one published EDD product by slug.

Single product DTO includes:

- `id`
- `title`
- `slug`
- `status`
- `date`
- `modified`
- `description`
- `short_description`
- `price`
- `variable_prices`
- `featured_image`
- `gallery`
- `categories`
- `tags`
- `file_type`
- `file_size`
- `compatible_with`
- `documentation`
- `featured`

Pricing uses EDD helpers when available:

```json
{
  "type": "single",
  "amount": 499,
  "formatted": "₹499",
  "currency": "INR"
}
```

Variable pricing:

```json
{
  "type": "variable",
  "currency": "INR",
  "options": [
    {
      "id": 1,
      "name": "Standard License",
      "amount": 449,
      "formatted": "₹449",
      "default": true
    }
  ]
}
```

### `GET /wp-json/ch/v1/products/sitemap?page=1&per_page=48`

Returns the standard success envelope with a full count of public products and
at most 48 lightweight items per page:

```json
{"success":true,"data":{"total":44792,"items":[{"slug":"product-name","modified":"2026-01-01T00:00:00+00:00"}]}}
```

Only published, non-password-protected downloads are included. The handler
uses bounded SQL for the count and page, returns only slug/modified/optional
Yoast canonical, and does not hydrate EDD objects or expose customer, order,
payment, download-file, or S3 data.
### `GET /wp-json/ch/v1/categories`

Returns all `download_category` terms, including empty categories.

Category DTO:

```json
{
  "id": 10,
  "name": "Graphics",
  "slug": "graphics",
  "description": "",
  "count": 450,
  "parent": 0
}
```

### `GET /wp-json/ch/v1/categories/{slug}`

Returns category information plus paginated products in that category. This keeps category landing pages convenient while `/products?category=slug` remains the simple product-list API.

## Errors

Errors use a stable envelope:

```json
{
  "success": false,
  "error": {
    "code": "product_not_found",
    "message": "Product not found."
  }
}
```

Expected statuses include `200`, `400`, `404`, and `500`.

## Media

Media fields return normalized attachment DTOs using safe WordPress attachment URLs and dimensions. The API does not expose local filesystem paths and does not deliberately expose Mayosis-specific image sizes or watermarked derivatives. Gallery images come from `vdw_gallery_id` where present.

## CORS

The plugin does not enable wildcard CORS. For local development, configure allowed frontend origins with:

```php
add_filter(
	'ch_api_allowed_origins',
	static function () {
		return array( 'http://localhost:3000' );
	}
);
```

Only `ch/v1` responses are considered for this optional CORS behavior.

## Known Legacy Data Issues

- Product post type is `download`.
- Product category taxonomy is `download_category`.
- Product tag taxonomy is `download_tag`.
- Tags are very large and noisy, so they are single-product only in this phase.
- Most excerpts are empty; excerpts containing Razorpay transaction text are suppressed.
- Some products lack featured images or optional merchandising meta.
- `compatible_with` includes legacy spelling variants such as `Adobe Illustration`.
- Gallery storage uses legacy `vdw_gallery_id`, but the API only exposes normalized attachment objects.
- Downloadable file metadata and S3 object paths are intentionally not exposed.

## Authentication foundation

The Next.js server is the only caller of the private account routes. Configure
the same random `CH_AUTH_BRIDGE_SECRET` value (at least 32 characters) in the
Next.js server environment and the PHP runtime environment. Do not put it in a
`NEXT_PUBLIC_*` variable or send it to browser code. Authentication endpoints
fail closed when the bridge secret is absent or too short. Production requests
also require HTTPS (`is_ssl()` must be true).

- `POST /auth/login` verifies credentials with WordPress native authentication
  and creates a revocable WordPress session token.
- `POST /auth/logout` revokes that token in WordPress session storage.
- `GET /customer/me` validates the token and resolves an EDD customer only by
  its `user_id` link. An absent association is returned as `null`; an email
  mismatch is returned as a boolean for server-side review. It never attaches
  customers by email or returns the EDD customer email.
- `POST /customer/claim/request` always returns the same generic response.
  It sends an email only when the primary EDD customer email identifies one
  active, unlinked EDD customer and has no ambiguous secondary-address match.
- `POST /customer/claim/complete` accepts a single-use 30-minute token. New
  WordPress accounts are created with the verified EDD email and the
  `subscriber` role. Existing WordPress users must authenticate to that exact
  email first. A database lock serializes claims, and EDD's customer update
  API writes the association. Existing customer associations are never
  merged or replaced.

The token is returned only to the trusted Next.js server over the bridge. Next
stores it in an `HttpOnly`, `SameSite=Lax` cookie, marked `Secure` in
production, and forwards it to WordPress server-to-server. Auth responses use
`Cache-Control: private, no-store`. Login is limited to eight failures per
15-minute window by IP and submitted email. In production behind a reverse
proxy, configure the web server so `REMOTE_ADDR` contains the verified client
IP; do not trust arbitrary forwarded-IP headers.

Claim tokens are stored as SHA-256 digests in short-lived WordPress transients.
Rate limits use WordPress-salted HMAC keys. Claim endpoints are non-cacheable;
verification links put the random token in the URL fragment so it is not sent
in HTTP request paths or referrers. The trusted Next.js bridge supplies its
configured server-only `CH_AUTH_FRONTEND_URL` origin. Local PHP mail should
route only to a loopback capture server such as Mailpit.

## Intentionally omitted

- Registration and password reset
- `/orders`, `/orders/{id}`, `/downloads`, `/licenses`
- `/search`, `/wishlist`, `/cart`, `/checkout`, `/payment/razorpay`

