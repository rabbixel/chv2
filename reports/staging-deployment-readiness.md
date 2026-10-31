# Creative Hatti — Staging Deployment Readiness

**Target under review:** frontend `https://creativehatti.in`; WordPress/EDD API `https://api.creativehatti.in`.
**State:** local preparation only. No deployment, DNS, production setting, credential or database change was made.

## Readiness summary

The frontend builds in an isolated production build, and the local search/API integration passes. Staging is **not ready for a traffic-bearing launch** until API plugin drift is reconciled, HTTPS bridge and environment values are set, CORS/security/CDN policy is verified, data/media backups and migration snapshots are confirmed, and authenticated EDD flows are tested with approved staging accounts.

## Hosting and runtime requirements

- Local reference versions: WordPress 7.1.4, PHP CLI 8.3.33, MySQL 8.4.3, EDD 3.7.3; local catalog contains 44,800 published products. Host support and extension compatibility must be confirmed for the chosen WordPress/PHP/MySQL versions.
- Custom Search and Homepage Sections headers require PHP 7.4 or newer; validate the full API plugin/runtime and EDD version against the target host. Use HTTPS and a maintained PHP release supported by the host.
- Required plugin order: WordPress core and EDD first; Creative Hatti API next; Indexed Search after API/EDD; Homepage Sections after EDD/API. Build/verify the search index using the documented approved process on the clean staging database. Do not run index rebuilds or database migrations as part of this audit.
- `creative-hatti-local-media-preview` is a local helper and should not be deployed unless its purpose is explicitly approved.

## Plugin file reconciliation

Read-only comparison with Laragon:

- `creative-hatti-home-sections`: all 6 repository files match the active copy.
- `creative-hatti-search`: runtime PHP source matches; README and repository-only test/helper files differ or are absent from the active installation.
- `creative-hatti-api`: `creative-hatti-api.php`, `includes/class-ch-cart-controller.php`, and `includes/class-ch-checkout-controller.php` differ; repository `includes/class-ch-communications.php` is absent from the active copy; README differs. This must be reviewed against the intended clean WordPress source before packaging. Nothing was synchronized.

The current repository tree is the candidate release source, subject to review of its uncommitted README/CORS changes. The detailed behavior comparison, regression evidence, and current working-tree SHA-256 file manifest are in [the API plugin release manifest](api-plugin-staging-release-manifest.md).

## Environment configuration (names only)

Set and verify through the approved secret manager or environment configuration:

- `CH_API_URL` — `https://api.creativehatti.in`
- `WORDPRESS_URL` — `https://api.creativehatti.in`
- `NEXT_PUBLIC_SITE_URL` — `https://creativehatti.in`
- `CH_AUTH_FRONTEND_URL` — `https://creativehatti.in`
- `CH_AUTH_BRIDGE_SECRET` — same random server-only value in Next and WordPress, minimum 32 characters; never `NEXT_PUBLIC_*`
- `CH_API_ALLOWED_ORIGINS` — exact comma-separated browser origins, including `https://creativehatti.in` where browser CORS is needed
- `USE_MOCK_API` — `false`
- `CH_AUTH_MODE` — `wordpress`
- `NEXT_PUBLIC_DEFAULT_PAGE_SIZE` — optional; currently 24 by default
- Payment gateway test-key and webhook settings — configure only in the approved staging/test mode; do not copy local/production secrets.
- S3/download credentials and signing configuration — server-side only; keep objects private and verify authorized signed-download flow.

Do not expose environment values in build logs or frontend bundles. Local `.env.local` uses an HTTP `.test` API origin and the current `.com` canonical fallback; it is not a staging configuration.

## CORS, auth, cookies and cache

- Allow exact HTTPS frontend origin `https://creativehatti.in` only where browser CORS is required. The custom `ch/v1` CORS implementation supports exact environment allowlists; validate deployed configuration. WordPress core REST routes outside `ch/v1` have separate reflected-origin behavior and need a staging-wide security review.
- Confirm secure/HttpOnly/SameSite cookie policy, origin checks, CSRF/session signatures, account bridge secret equality, login/claim rate limits and expired-session recovery. Never disable checks to make a smoke test pass.
- Next uses 60s homepage/search fetch revalidation, 1,800s product detail, and 3,600s catalog/category reads; availability and user state use no-store. No WP-to-Next revalidate webhook was found. Decide whether these TTLs meet freshness requirements.
- Direct public WP search response had no `Cache-Control`; Next output returned `private, no-store`. Configure CDN caching only for proven public GET paths, with explicit bypass for cart, checkout, account, auth, orders, payments, wishlist, nonce, and download paths.
- Verify CDN headers, TLS, HSTS, CSP/frame-ancestors, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, WAF/rate limits and origin shielding.

## SEO and indexing safeguards

- Set the staging canonical origin explicitly to `https://creativehatti.in`; verify product/category canonical URLs, `robots.txt`, sitemap index and generated sitemap URLs after deployment.
- Keep staging protected from indexing until explicit launch: HTTP authentication or equivalent access control plus `X-Robots-Tag: noindex` and a staging robots policy. Remove noindex deliberately at launch; do not rely on robots disallow alone to protect a public staging site.
- Re-run complete sitemap coverage against a low-load staging snapshot; local prior check only sampled first/last chunks. Recheck legacy redirects, noindex on search/gallery/filter routes, and structured data against EDD pricing/availability.

## Database, media and download preparation

- Take and restore-test a clean WordPress database and uploads backup before staging. Local inventory was about 2.49 GB data / 1.33 GB indexes, 44,800 products, 6,272 customers, 17,017 modern EDD orders and 17,178 legacy payment posts; counts are local observations, not a migration manifest.
- Reconcile product/customer/order/guest-purchase/download permissions from the approved clean local source with a snapshot timestamp. Do not infer that derived search tables or caches are authoritative; follow the migration plan and rebuild derived search data only after separate approval.
- Compare media inventory against staging uploads. Earlier audits flagged products #32238 and #222061 without featured images; manual review is required. Do not copy all uploads or regenerate thumbnails.
- Verify private S3 objects remain private, and authorized downloads use current EDD entitlement checks. Do not expose raw S3 URLs.

## Payment and cutover safety

- Keep Razorpay in test mode for staging. Confirm gateway coexistence, signed webhook endpoint, test-key restrictions, webhook delivery/idempotency and EDD fulfillment using test orders only. No real payment was made.
- Preserve current Mayosis production untouched. Before any future cutover, take a final legacy order/customer snapshot and reconcile orders/customers created after the local snapshot, including guest purchases and downloads.
- No DNS change is included in this readiness work.

## Deployment sequence

1. Confirm clean source versions, file drift review, dependency compatibility, verified database/uploads backups and restore procedure.
2. Provision isolated staging WordPress, HTTPS, PHP/MySQL, EDD and required extensions.
3. Import approved local clean-source database/uploads; verify EDD records and media read-only before activation.
4. Activate EDD, then Creative Hatti API, search, and Homepage Sections in order; validate REST routes, options, search index readiness and logs.
5. Configure server-side environment names above, exact CORS origins, secure cookies, test payment keys and private downloads.
6. Deploy Next staging build with `.in` canonical/API origins and staging noindex/access protection.
7. Run security, SEO, image, responsive/a11y, search, catalog, account, cart, free checkout, paid sandbox payment and private download acceptance tests.
8. Obtain owner sign-off before changing any public DNS or payment mode.

## Pre-DNS validation checklist

- [ ] Local/host PHP, WordPress, MySQL, EDD versions and extensions supported.
- [ ] Plugin drift resolved intentionally; all REST routes and options verified.
- [ ] Env origins, secret pairing, CORS, HTTPS, cookies and auth tested.
- [ ] Search/index counts, filters, broad-query latency and cache freshness tested.
- [ ] Canonical, robots, sitemap coverage, redirects and noindex reviewed.
- [ ] Image host allowlist, originals, dimensions, responsive `srcset`, no broken media and visual cropping checked.
- [ ] Full responsive keyboard/touch/accessibility smoke at 320/390/768/1024/1440.
- [ ] Cart, free EDD checkout, paid sandbox checkout, webhook/fulfillment and authorized download tests passed.
- [ ] CDN does not cache sensitive routes; TLS/security headers/WAF/rate limits verified.
- [ ] Database/uploads backups restore-tested; post-snapshot live-site orders reconciled.
- [ ] Rollback owner, trigger thresholds and DNS sequence approved.

## Rollback plan

Before launch, retain the current Mayosis site, immutable backups, prior staging plugin artifacts and environment snapshots. If a critical API, payment, authorization, download, SEO/redirect, or data-integrity validation fails, stop rollout, restore the last verified staging artifact/configuration, and leave production DNS unchanged. If a later approved DNS cutover has begun, revert DNS to the legacy host using the pre-agreed TTL and preserve new-site orders for reconciliation; do not delete or merge records during rollback.
