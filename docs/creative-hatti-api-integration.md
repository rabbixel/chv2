# Creative Hatti API Integration

## Configuration

The frontend reads the WordPress catalogue API from the server-only environment variable:

```env
CH_API_URL=http://creativehatti.test/wp-json/ch/v1
```

No browser-exposed API URL is required for the public catalogue phase. `USE_MOCK_API=true` can still force the local mock services.

## Service Architecture

UI code continues to read catalogue data only through `@/lib/services`.

- `lib/api/client.ts` owns base URL resolution, fetch options, error handling, and Next.js cache settings.
- `lib/api/endpoints.ts` contains the Creative Hatti route paths.
- `lib/creative-hatti/types.ts` describes the WordPress API response shapes.
- `lib/creative-hatti/adapters.ts` normalizes API envelopes into existing frontend `Product` and `Category` models.
- `lib/services/productService.ts`, `categoryService.ts`, and `searchService.ts` choose the API implementation when `CH_API_URL` is configured.

## Integrated Routes

- `/` uses real featured products and real category counts.
- `/search` uses `GET /products` as the paginated browse/archive surface.
- `/category/[slug]` uses backend category filtering through `GET /products?category=...`.
- `/product/[slug]` uses `GET /products/slug/{slug}` for product detail, gallery, metadata, SEO, and Open Graph.
- `/sitemap/1.xml` includes the latest 48 products from the catalogue API.
- The homepage's character and featured-pack cards can be curated in WordPress
  through the separate `Creative Hatti Homepage Sections` plugin. Its
  `GET /homepage-sections` endpoint is read by `HomepageService`; disabled
  sections continue to use the storefront's built-in content.

## Homepage card curation

Install `wordpress/creative-hatti-home-sections/` into the WordPress plugins
directory and activate it. In **Settings → Homepage Sections**, select EDD
`download_category` terms, set optional card copy and accent hues, choose a
fallback illustration, and pick thumbnail images from the Media Library.
The plugin exposes only this public editorial content at
`/wp-json/ch/v1/homepage-sections`; edits remain behind WordPress's
`manage_options` capability.
The storefront refreshes these choices at least once per minute.

## Field Mapping

Products map title, slug, price, featured image, gallery, categories, tags, featured state, file type, file size, compatible-with, documentation flag, created date, and modified date.

Prices from the API are rupee values and are converted to the app's minor-unit `Money` shape for existing `formatMoney()` usage.

Category slugs are normalized where the old frontend taxonomy differs from WordPress:

- `character-bundles` -> `character-bundle`
- `miscellaneous-character-bundles` -> `miscellaneous`

## Images

`next.config.ts` allows images from:

- `http://creativehatti.test`
- `https://creativehatti.test`
- `https://cdn.creativehatti.com`

The app still uses `next/image`; no global `unoptimized` escape hatch was added.

## Caching

Current revalidation windows remain:

- catalogue/category lists: 3600 seconds
- product detail: 1800 seconds
- search/browse responses: 60 seconds
- static/home content: 86400 seconds

This is simple ISR-ready caching until explicit webhook invalidation exists.

## Known Limitations

- Search is not implemented yet. `/search` is currently the browse/archive page and does not perform keyword search against the backend.
- File type facets are empty in API mode because the current category/product endpoints do not expose aggregate file-type counts.
- Sort support is conservative. Newest/oldest are sent as date order; best-selling, rating, title, and price sorting need confirmed backend parameters before use.
- Full product sitemap coverage needs a backend sitemap/index endpoint. The catalogue API caps `per_page` at 48, so build-time crawling all 44,792 products is intentionally avoided.
- Cart, checkout, auth, dashboard, protected downloads, wishlist backend, licenses, and Razorpay remain pending by design.

## Live API Smoke Tests

Verified against:

- `GET /products?per_page=2`
- `GET /products?per_page=2&category=freebies`
- `GET /products?per_page=2&featured=true`
- `GET /products/slug/portrait-of-tennis-players-playing-on-a-rooftop`
- `GET /categories/freebies`
