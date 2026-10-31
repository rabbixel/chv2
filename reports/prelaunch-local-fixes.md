# Creative Hatti — Pre-launch local fixes

## Implemented

1. **Prioritize the first product-grid image only.** `ProductGrid` passes `priorityImage` for index 0 to `ProductCard`/`ProductImage`; later images preserve lazy loading. This addresses a confirmed Next development warning that the above-fold category LCP candidate was lazy-loaded. SSR inspection on `/category/freebies` showed the first card image eager and later cards `loading="lazy"`. No numeric Web Vitals claim is made without browser instrumentation.
2. **Suppress the framework response header.** Added `poweredByHeader: false` to `next.config.ts`. Before: local `/` exposed `X-Powered-By: Next.js`; after config reload: header absent; route remained HTTP 200.

Both are frontend-only, narrow, reversible, and do not change API semantics, product data or checkout.

## Measurements and regressions

- Search integration against the local API: 4 tests passed, 1 Next-render integration case skipped by its test setup; the bounded concurrent sample reported index p95 2,675 ms and HTTP p95 4,308 ms.
- Sitemap boundary sample initially saw 8 missing IDs in the tail, then after refresh passed with 64 URLs checked and zero missing, duplicates, extras, wrong domains/routes or bad index. No full scan was performed.
- Route smoke samples and SEO metadata passed: product/category canonical origins were `https://www.creativehatti.com`; search and Gallery Preview robots directives were correct; sitemap index contained 935 chunk references.

## Tests/checks

- `node --test tests/*.test.mjs`: 195 passed, 6 skipped, 0 failed (201 total).
- `npm run test:search:integration` against local API: 4 passed, 1 skipped, 0 failed; measured local catalogue queries.
- Focused product grid, canonical and pagination tests: 13 passed, 1 skipped.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- PHP syntax checks: all PHP files in the custom homepage-sections, search and API plugins passed.
- PHP orientation classification, orientation search contract and pricing-classification tests: passed.
- `tests/wordpress-homepage-packs.php`: attempted, failed at the test harness because `get_attached_file()` is not stubbed; it did not access or modify the database.
- `git diff --check`: passed; Git printed only line-ending normalization notices for existing CRLF files.
- Production build not run because the valid dev server uses the shared `.next` directory; it was not killed or overwritten.
- Browser viewport/accessibility/checkout flows not visually verified because no browser automation surface was available.

## Remaining known issues

- Broad search latency needs staging-like load measurement and database/query-plan review before optimizing.
- WordPress core CORS reflection with credentials needs explicit staging security review; no cross-origin authenticated data access was demonstrated. Do not change production or core behavior based only on local results.
- The first sitemap tail response was transiently short; repeat full coverage on a quiet local/staging snapshot before claiming complete parity.
- README still describes mock-only operation and should be updated separately.
- Previously audited missing featured images and old attachment references remain as described in the audit report; no media was modified.

## Follow-up: CORS and search profile (2026-10-31)

- CORS: fixed locally for custom `ch/v1` responses in `wordpress/creative-hatti-api/includes/class-ch-api.php`; active Laragon file backed up and synchronized. 11 policy assertions and live local request/header checks passed. Core non-`ch/v1` routes remain untouched.
- Search: remeasured broad queries before/after CORS sync; results/counts remained stable but no timing improvement was made or claimed. Query profile found the broad-match insert, facet aggregation and page sort account for nearly all handler SQL time. Search SQL/index optimization remains out of scope and needs separate approval/review.
- Detailed measurements and rollback instructions are in `search-performance-before-after.md` and `wordpress-cors-security-review.md`.
