# Creative Hatti — Pre-launch staging checklist

No staging or production services were contacted or changed in this audit.

## Before staging smoke test

- [ ] Take and verify a restorable WordPress database and uploads backup; separately capture Next/Vercel environment configuration without placing secrets in frontend variables.
- [ ] Deploy only after the approved clean WordPress source and Next build are ready. Confirm active WordPress/PHP/MySQL/EDD versions and required extension/plugin activation order against host support.
- [ ] Set the intended production origins explicitly: frontend `https://www.creativehatti.com`, backend `https://api.creativehatti.com`; verify `SITE.url`, media URLs, auth bridge frontend origin, secure cookies and no localhost/`.test` in server output.
- [ ] Confirm `CH_AUTH_BRIDGE_SECRET` exists server-side on both sides, is identical, >=32 random characters, and never in `NEXT_PUBLIC_*`; rotate through approved secret-management process if needed.
- [ ] Confirm Razorpay credentials/webhook signing only via approved owner; test gateway sandbox before live-key activation. Do not use local audit credentials.
- [ ] Confirm S3 private files remain private, signed/authorized download endpoints work, and no private keys or file URLs appear in client JSON/HTML.

## Security and API

- [ ] Review WordPress REST CORS behavior. Local probes observed WordPress core echo arbitrary `Origin` with credentials. Verify origin policy and prove private user/order/download routes cannot be read cross-origin; allow only exact frontend origins if browser access is required.
- [ ] Confirm server bridge/session checks, CSRF/origin validation and login/claim/checkout rate limits with staging accounts; test failed/expired sessions without weakening validation.
- [ ] Verify CDN/WAF protects public search against abusive query volume; local broad-search p95 was about 4.3 s end-to-end under a small 3-concurrent sample.
- [ ] Inspect response headers at the edge: CSP/frame-ancestors, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy; check that edge cache never shares account/cart/checkout responses.
- [ ] Run current dependency advisory scan and authenticated security testing with an approved tool/window.

## SEO, URLs and crawl

- [ ] Verify live `robots.txt`, canonical host (`www`), sitemap index and all product chunks from the public network; current local test checked only first and last chunks (64 URLs).
- [ ] Re-run `scripts/verify-sitemap-coverage.mjs --full` against an isolated snapshot or low-load window. Validate missing/duplicate/extra canonical URLs and exact product count.
- [ ] Confirm Search Console property, sitemap submission and live crawl manually; audit reports do not submit anything.
- [ ] Check legacy Mayosis product/category aliases against real historical URL samples; verify every redirect ends at a 200 canonical page with no chains or loops. Do not infer unlisted legacy aliases.
- [ ] Verify production `/search` noindex, Gallery Preview noindex/nofollow/noarchive, filtered listing noindex rules and product Offer price/availability against EDD data.

## Performance, imagery and UX

- [ ] Use browser-based Lighthouse/Web Vitals at 1440/1280/1024/768/390/320 widths; verify LCP, CLS, image requests, fonts, no horizontal overflow, keyboard/focus, touch, dialogs, contrast and console errors.
- [ ] Confirm the first product card image is prioritized and later images remain lazy; verify responsive `srcset` and source artwork composition for portrait/square/landscape assets.
- [ ] Reconcile the prior media audit's two missing featured-image products (#32238, #222061) and attachment references against the production uploads snapshot before cutover; do not auto-replace missing media.
- [ ] Run real free/paid purchase and download tests only with approved staging gateway and test accounts. Validate cart, wishlist, license IDs, session expiry, order fulfillment and secure download authorization without production orders.

## Data migration and rollback

- [ ] Freeze/record a final legacy-site order/customer snapshot time; reconcile all subsequent legacy live orders and guest purchases before cutover so they are not omitted.
- [ ] Verify EDD customers, orders, line items, adjustments, licenses, wishlist and access grants after import using read-only reconciliations and sampled account tests.
- [ ] Keep DNS TTL/cutover sequence documented, prepare rollback to the legacy site, and define explicit rollback triggers (checkout failure, missing downloads, critical SEO/redirect regression, API outage).
- [ ] Keep the current Mayosis site untouched until authorized launch; preserve backups and access logs.
- [ ] Obtain owner sign-off for staging validation before DNS changes. No production action is authorized by this local audit.

## Follow-up: CORS and search (2026-10-31)

- Local custom `ch/v1` CORS now has an exact environment allowlist; untrusted preflights receive no allow-origin, credential, method, header or expose policy. Confirm the final production allowlist and test authenticated flows on staging.
- WordPress core routes outside `ch/v1` retain their core reflected CORS behavior. Review whether staging needs a broader allowlist policy; no authenticated exposure was demonstrated locally.
- Broad-search work is concentrated in DB query/match/facet/sort costs. No search-index changes were made; run reviewed `EXPLAIN ANALYZE`/load tests on a staging-like replica before any reversible schema/query optimization.
