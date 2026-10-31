# Creative Hatti — Pre-launch local audit

**Run date:** 2026-10-31 (Asia/Kolkata)  
**Scope:** Local Laragon WordPress/EDD and local Next.js only. No production or staging requests; no DB writes or EDD transaction tests.

## Executive summary

Local API-backed storefront is running and the indexed catalogue is ready. The audit found **0 Critical, 0 High, 2 Medium, 2 Low, and 2 Informational findings**. Two low-risk frontend fixes were applied: prioritize only the first product-grid image, and remove the `X-Powered-By: Next.js` response header. Existing staged/uncommitted work was preserved.

The strongest launch risks to resolve on staging are search latency under realistic load and an origin-reflecting credentialed CORS response from WordPress REST. The latter is WordPress core behavior observed locally; custom account/payment endpoints still have bridge/session checks, and an unauthenticated `/customer/me` request failed closed with HTTP 503. No cross-origin data exposure was demonstrated. Do not infer production behavior from this local environment.

## Baseline

- Next.js 16.3.6, React 19.3.0, TypeScript 6.0.3, Node 24.19.0, npm 11.17.0.
- Laragon binaries available: PHP 8.3.33 CLI, MySQL 8.4.3, Apache 2.4.68, Nginx 1.30.4. The binaries are installed but PHP/MySQL commands are not on the ordinary shell PATH.
- Local WordPress 7.1.4, EDD 3.7.3, Yoast SEO 28.8. Local DB inventory: 108 tables; about 2.49 GB data and 1.33 GB index. Product/order counts below are read-only bootstrap results.
- 44,800 published products; search index ready with 44,800 documents, 1,583,090 tokens, 356,206 facets. Indexed pricing parity: 44,800 valid, 44,330 paid, 470 free, zero mixed/invalid. 90,348 attachments. EDD: 6,272 customers, 17,017 modern orders, 18,841 order items, 884 adjustments, 17,178 legacy payment posts. These are observations only; no records changed.
- Active Next dev process PID 20884 belonged to this repository and was left running. Local browser automation inventory was empty; Playwright was not installed.
- `.env.local` was inspected by key names only. It contains local WordPress/API/auth bridge configuration; secret values were not printed. No Razorpay keys were present in the Next environment and no `NEXT_PUBLIC_*` secret-like variables were found. `NEXT_PUBLIC_SITE_URL` is absent, so `SITE.url` currently defaults to `https://www.creativehatti.com` for canonical/SEO URLs.
- `README.md` still describes an earlier mock-only setup; it is stale relative to the active local API configuration.

## Findings by severity

### Medium (2)

1. **Search latency is material on broad queries.** The real local integration suite exercised 44,800 products, validated keyword/prefix/category combinations, free/paid, price, orientation, sorting, pagination and malformed inputs. In the bounded timing sample, index-query p95 reached 2,675 ms and end-to-end HTTP p95 reached 4,308 ms; broad `banner` query was about 3.4–4.4 s while a combined narrow Diwali query took about 1.6 s and 38 ms inside the search service. Local HTTP/WordPress startup/cache effects contribute. The integration suite measured 3-concurrent reads. This is a staging load-test item; do not tune SQL/index semantics from this local sample alone.
2. **WordPress REST CORS reflects arbitrary `Origin` with credentials in the local environment.** OPTIONS probes to both public products and `/customer/me` echoed `https://evil.example` with `Access-Control-Allow-Credentials: true`. Source inspection shows WordPress core `rest_send_cors_headers()` reflects `get_http_origin()`; the custom API's optional CORS helper only adds an origin configured in its allowlist, but core behavior remains. The storefront currently calls the API server-side. Unauthenticated `/customer/me` returned generic 503 (`auth_bridge_unavailable`) and did not expose account data. No authenticated cross-origin test was attempted. Have the backend/security owner verify the intended allowlist and browser-accessible routes in staging before launch; do not assume this local result is production configuration.

### Low (2)

3. **First sampled sitemap tail response was transiently short.** First boundary run reported 8 missing product IDs in the last chunk; after refreshing the tail endpoint, the same bounded verifier reported 64 URLs checked, 0 missing, 0 duplicate, 0 extra, 0 wrong domain/route and a valid index. The API tail itself reports 16 items. This indicates a transient stale/refresh response or development cache race, not a confirmed persistent gap. A full scan is still required for a complete coverage claim.
4. **Framework header disclosure (fixed locally).** Before the change, the storefront returned `X-Powered-By: Next.js`. Set `poweredByHeader: false` in `next.config.ts`; after the local config reload, `/` returned 200 with no `X-Powered-By` header. Low impact; confirm on staging/CDN too.

### Informational (2)

5. **Character archive probe initially used the wrong path.** `/category/character-bundles` is not the Next taxonomy route and returns 404. The actual group route is `/category/character-bundle` (singular), which returns 200 and canonicalizes to that route. The WordPress taxonomy also contains a separate term named “Character Bundles” with slug `character-bundles`; it is not the Next product-group route. This is a test-URL mismatch, not a confirmed page defect.
6. **Repository guide is stale.** README claims mock-only behavior despite the configured local API-backed services. Update documentation separately so operators do not select the wrong verification mode.

## API and performance evidence

All timings are local samples, not production SLAs. WordPress REST `/wp-json/` and custom catalog/search endpoints returned 200. Representative observed values:

| Scenario | Observed local timing | Result |
|---|---:|---|
| Categories list | about 1.77 s | 35 categories |
| Product list, page 1, one item | about 1.66 s | 44,800 total |
| Product detail | about 1.57 s | 200 |
| Product sitemap feed page 1 | about 3.28 s | 44,800 total |
| Indexed Diwali query | about 1.78 s HTTP / 251 ms service | 741 results |
| Free-only query | about 1.59 s HTTP / 28 ms service | 470 results |
| Paid-only query | about 4.14 s HTTP / 2.43 s service | 44,330 results |
| Portrait orientation | about 1.81 s HTTP / 141 ms service | 1,561 results |
| Zero-result query | about 1.67 s HTTP / 93 ms service | 0 results |
| Broad `banner`, 24 per page | 3.46–4.40 s HTTP / 1.82–1.93 s service | 21,046 results / 877 pages |
| Deep page 877 | about 3.39 s | 22 products |
| Out-of-range page 50,000 | about 1.73 s | safely clamped to page 31/31 |

Requests are bounded/paginated. The Next search service uses a 60-second revalidation window; purchase availability is separately refreshed no-store. No N+1 failure was demonstrated in these probes. Search integration tests confirmed server-side orientation filtering, result counts before pagination, combined filters, relevance/newest/best-selling/price sorting and invalid/oversized input rejection. Response time varies substantially with query breadth and cache warmth.

## Local route and technical SEO smoke checks

Local Next GET results: `/`, `/search?q=diwali`, `/gallery-preview?q=diwali`, `/category/vector-creatives`, `/category/character-bundle`, `/category/freebies`, `/cart`, `/checkout`, `/login`, `/robots.txt`, sitemap index and sampled sitemap chunks returned 200. `/account/wishlist` correctly redirected guests to login. The invalid plural group path returned 404 as described above. Legacy `/downloads/:slug`, `/products/:slug`, `/categories/:slug` were observed redirecting to singular/current routes (308); unknown slugs correctly land on a not-found product after redirect.

- Home canonical: `https://www.creativehatti.com`.
- Category canonical samples use `https://www.creativehatti.com/category/{slug}`.
- Product sample canonical and JSON-LD `Product.url` use `https://www.creativehatti.com/product/{slug}`.
- Search metadata is `noindex, follow`; `/gallery-preview` is `noindex, nofollow, noarchive`.
- Category query state is noindexed by page metadata when filter/page state is present.
- Product JSON-LD sample contained INR `Offer`, price and `InStock`; no rating/review fields were invented. Breadcrumb JSON-LD appeared on category and product samples. Home emitted Organization/WebSite graph.
- `robots.txt` disallows API, cart, checkout, account, wishlist and auth paths and points to `https://www.creativehatti.com/sitemap.xml`.
- Sitemap index had 935 entries: one static/taxonomy chunk plus 934 product chunks. Bounded boundary verification passed for 64 product URLs (first and last chunks); full-catalog coverage is not claimed.
- Sitemap URLs and page metadata intentionally target the configured Next.js production domain; local HTML did not contain localhost or `.test` canonical URLs.

## Security and privacy observations

- Custom catalog endpoints are public-read by design. Search inputs are sanitized/validated and the indexed search SQL uses prepared values; local invalid/oversized input was rejected. Public search is not rate-limited in the examined plugin; staging CDN/WAF rate controls and query load should be tested.
- Custom account/cart/checkout/payment/download routes were source-inspected for bridge/session permission callbacks. Payment and download transactions were not invoked. The Next storefront uses server-side API access; no API secret was exposed to `NEXT_PUBLIC_*` in the inspected environment names.
- Local `customer/me` without bridge credentials failed closed with a generic 503. No direct S3/private download URL was requested or exposed.
- Local response headers include `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy` disabling camera/microphone/geolocation. HSTS is correctly absent on local HTTP and is configured only in production. CSP/frame-ancestors are not set in Next headers; repository comments say framing policy is provided at the production edge. Verify that edge policy in staging.
- No dependency vulnerability database or authenticated external security scan was available/run. Review current package advisories and hosting controls before launch.

## Mobile, accessibility and image delivery

- No browser surfaces were available, so no visual viewport, keyboard, focus, modal, contrast, touch or console testing is claimed at 320, 390, 768, 1024 or 1440 px. CSS/module and automated contract tests passed, but that is not visual verification.
- Existing image audit reports were reviewed rather than repeating a costly full media scan: `creative-hatti-media-integrity-2026-10-30.csv` records two products without featured images (#32238 and #222061) and prior stale attachment references for manual review; the 2026-10-31 orientation audit covers all 44,800 products and reports 44,798 featured references with valid paths/dimensions. Missing optional WordPress-generated variations should not be treated as missing originals. Recheck current state/asset URLs on staging; no media files or product records were changed.
- Product cards use responsive Next Image sizing and lazy loading; the first card in a product grid is now prioritized as an LCP candidate, while later cards remain lazy. Local server-rendered HTML confirmed the first card image is eager and subsequent cards lazy. No numeric LCP/CLS value was measured because a browser/Web Vitals runner was unavailable.
- Existing full-artwork `contain` contract and dimensions tests passed. Actual mobile crop/artwork appearance remains unverified visually.

## Limitations

- No authenticated browser was available. No visual or end-to-end authenticated checkout/free-download test was performed; executing real checkout would mutate EDD records and was outside this audit.
- Full sitemap scan would make 934 sitemap chunk requests (2-concurrency, 250 ms worker pacing) plus local DB scan. To avoid sustained load against WordPress, only first/last chunks were checked. Complete all-chunk counts require an agreed maintenance window or an isolated DB/API snapshot.
- `npm run build` was not run because a legitimate Next dev server held the shared `.next` directory. It was not stopped or overwritten. Use an isolated build output/config or schedule after the dev server is stopped.
- `tests/wordpress-homepage-packs.php` was attempted but its stub harness fatals because it does not define the newer WordPress `get_attached_file()` function; no database data was touched. Other focused PHP classifier/orientation tests and PHP syntax checks passed.

## Follow-up: local search/CORS review (2026-10-31)

The repeated performance profile and CORS remediation are documented in `search-performance-before-after.md` and `wordpress-cors-security-review.md`. The search root cause was measured in the indexed-search SQL; no search plugin/index change was made because it is outside the current approved scope. The custom `ch/v1` namespace now removes WordPress core's reflected CORS credentials and applies an exact local/environment allowlist. WordPress core behavior remains on non-`ch/v1` routes; no authenticated exposure was demonstrated and a staging-wide review remains necessary.
