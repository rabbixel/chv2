# Creative Hatti — Final Local Performance, Caching, Image Delivery & Build Audit

**Date:** 2026-10-31 (Asia/Kolkata)
**Scope:** Local Laragon WordPress and local Next.js only. No deployment, DNS, database write, EDD transaction, payment, or private-download action was performed.

## Executive summary

- The isolated Next.js production build succeeded with webpack. The default Turbopack attempt in the isolated temp copy stopped before compilation because the junction to the shared `node_modules` directory was outside Turbopack's filesystem root. The active dev `.next` was not touched.
- A real local API integration run passed 5/5. The bounded 3-concurrent search sample was index p50 **85 ms**, p95 **1,637 ms**, and HTTP p95 **3,382 ms**. Broad searches remain a staging load-test item; no SQL/index edits were made in this audit.
- Cache policy is conservative for personalized state. Public catalogue fetches have bounded Next Data Cache revalidation; customer/cart/wishlist/checkout state and product availability are `no-store`. WordPress public catalogue responses currently have no explicit `Cache-Control` header. Dynamic Next page responses in the production smoke were also `private, no-cache, no-store`; do not add a shared CDN cache until route personalization and invalidation are designed and verified.
- The staging backend hostname `api.creativehatti.in` was missing from Next's remote image allowlist. That exact HTTPS uploads host was added. No image files or WordPress media were modified.
- Browser automation was unavailable. No Lighthouse or numeric LCP/CLS/INP results are claimed, and viewport, keyboard, focus, contrast, touch and dialog checks remain outstanding.

## Caching audit

### Server-side data cache

The shared `lib/cache.ts` policy sets these Next Data Cache windows:

| Data | Revalidation | Notes |
|---|---:|---|
| Catalog, category, collection directory | 3,600 s | Tagged by products/categories; card availability is fetched separately. |
| Product detail/media metadata | 1,800 s | Product tags are attached to detail reads. |
| Indexed search | 60 s | High-cardinality query URL is part of the cache key. |
| Homepage sections | 60 s | Homepage settings are not cached with customer state. |
| Static content | 86,400 s | Service-level default for stable marketing data. |
| Availability overlay | no-store | Fresh bounded batch response on render. |
| Cart, wishlist, auth, checkout, customer/order/download | no-store | Session-bound service calls do not use the shared data cache. |

No `revalidateTag` path was found to connect WordPress product or homepage edits to Next's Data Cache. The current design therefore relies on the listed TTLs for WP-originated changes; product copy/prices can remain stale for up to the relevant TTL, while availability is refreshed separately. Homepage section edits can remain stale for up to 60 seconds. Treat this as an explicit freshness bound, not immediate invalidation.

### HTTP/CDN cache behavior

- Direct local `ch/v1/indexed-search` returned HTTP 200 with no `Cache-Control` header. Public catalogue endpoints should not be CDN-cached by assumption; if a CDN rule is added, scope it to known public GET paths and bypass all authenticated, mutation, cart, checkout, payment, customer, order, nonce and download routes.
- The isolated production server returned `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` for homepage, search, category, cart, checkout and wishlist. This is safe but means the outer HTML is not shared-cacheable. Server-side fetch caching still applies to public data. Revisit only with a design that preserves wishlist/cart/auth personalization and correct cache keys.
- WordPress custom cart, checkout, auth, payment, wishlist and availability controllers explicitly set private/no-store headers. This behavior must remain in staging.

## Image delivery audit

- `ProductImage` uses Next Image with `fill`, a caller-provided `sizes`, intrinsic aspect-locked parent slots, lazy loading by default, and the `priority` flag for the LCP candidate. `ProductGrid` sets priority only on its first product card; homepage Hero prioritizes only the first split-mode image. This preserves responsive source selection and avoids eager-loading entire grids.
- Product artwork fitting remains in existing components/styles; this audit made no layout or artwork changes. WordPress thumbnail suffix normalization and image URL normalization remain in `lib/creative-hatti/media.ts`.
- Local product images bypass Next optimization in development. Production uses Next Image optimization. Visual sharpness/cropping, optimizer response cache headers, layout shift and actual LCP were not measured in a browser.
- Added `https://api.creativehatti.in/wp-content/uploads/**` to `next.config.ts` remote patterns so the stated staging WordPress image host is accepted by Next Image. Other staging media hosts must be explicitly added only if the chosen architecture uses them.
- Prior media audit findings remain: products #32238 and #222061 were reported without featured images; no media was restored or changed.

## Bounded local smoke and performance measurements

One serial request pass against the isolated production server returned:

| Route | Status | Response bytes | Elapsed |
|---|---:|---:|---:|
| `/` | 200 | 285,793 | 8,551 ms |
| `/search?q=diwali` | 200 | 105,614 | 3,448 ms |
| `/category/freebies` | 200 | 285,261 | 3,445 ms |
| `/cart` | 500 | 28,714 | 56 ms |
| `/checkout` | 500 | 27,890 | 38 ms |
| `/account/wishlist` | 307 | 28,372 | 51 ms |
| Local WordPress indexed search | 200 | 6,581 | 2,804 ms |

These are one-off local HTTP observations, not controlled benchmarks or Web Vitals. Cart and checkout errors were caused by the production-mode auth bridge security guard: local `.env.local` points `CH_API_URL` to `http://creativehatti.test`, while production mode requires HTTPS. The configured bridge secret met its length check; its value was not printed. The 307 wishlist redirect is expected without an authenticated session. Do not weaken these checks; staging must use HTTPS and aligned server-only bridge settings.

Real API integration suite: **5/5 passed**, including search/filter/orientation validation and Next search rendering. Bounded 3-concurrent sample: index p50 **85 ms**, p95 **1,637 ms**; HTTP p95 **3,382 ms**. Slowest index examples: `illustrator` 1,637 ms, `vector` 1,618 ms, `profession` 796 ms. This sample is not a load test.

## Responsive and accessibility checks

Computer-use inventory had no browser or app surfaces; IAB browser creation was unavailable. Therefore, no actual visual/browser QA is claimed for 320, 390, 768, 1024 or 1440 px. Keyboard navigation, focus visibility, contrast, touch interactions, modal focus, console errors, horizontal overflow, and mobile screenshot checks remain outstanding. Source contracts and automated tests passed, but do not replace those checks.

## Confirmed fixes applied

1. Added the exact `.in` staging WordPress media host to Next's remote image allowlist.
2. Fixed a production build blocker in receipt print CSS: global-only selectors were placed in a CSS Module and webpack rejected them as impure. The global print hiding rules now live in `app/globals.css`, guarded by the receipt page marker; receipt-only module styles remain local.

No API/cache policy, WordPress plugin, database, payment, media, or search-query changes were made.

## Verification

- Isolated production build: passed using `next build --webpack`; 53 routes generated. It used `.env.local` and a separate temp working copy/output. Active dev output was not overwritten.
- Node tests: **195 passed, 7 skipped, 0 failed** (202 total).
- Real local search integration: **5 passed, 0 skipped, 0 failed** when explicitly pointed at `http://creativehatti.test/wp-json/ch/v1` and the local storefront.
- TypeScript typecheck: passed.
- ESLint: passed after temporary audit scripts are removed; the first run saw one warning from a temporary helper that is not part of the final worktree.
- Custom plugin PHP syntax: **29/29 passed**.
- PHP harnesses: **20/22 passed**. `tests/search-index.php` is a WP-CLI command requiring `--path`/`--url`, not a standalone test. `tests/wordpress-homepage-packs.php` still fails in its stub harness because it does not define `get_attached_file()`; no database access/write occurred.
- `git diff --check`: passed; Git emitted only line-ending normalization notices for existing modified CRLF files. No whitespace errors.

## Remaining limitations

- Broad search p95 remains over one second; validate on a staging-sized/representative database and expected concurrency before more query work.
- No WordPress-to-Next on-demand cache invalidation path was found. Confirm TTL acceptability or design a signed invalidation flow separately.
- Public WP API routes have no explicit cache header in the checked response; staging CDN policies need explicit allowlisted paths and hard private-route bypasses.
- Production-mode cart/checkout cannot be validated against plain-HTTP local WordPress; they require HTTPS staging credentials and test accounts. No transaction was created.
- No visual browser, Lighthouse, responsive accessibility, image optimizer caching or numeric Core Web Vitals verification was available.
