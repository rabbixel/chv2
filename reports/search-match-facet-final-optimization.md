# Final Local Search Match and Facet Optimization

**Date:** 2026-10-31 (Asia/Kolkata)  
**Environment:** Laragon WordPress `creativehatti.test`, PHP 8.3.33, MySQL 8.4, 44,800 indexed products. Local-only; no persistent data or schema changes.

## Outcome

One narrow optimization was retained: for a request with at least **40,000 matches**, aggregate category/file-type facets with a facet-first join order. For smaller result sets, keep the existing match-first join order. The already optimized page-selection query remains unchanged.

For broad `vector` (43,778 matches), the facet SQL median fell from **1,113.58 ms** to **345.71 ms** in the bounded local samples (about **68.9% faster**). For `vector` + paid (43,332 matches), the median fell from **999.43 ms** to **493.25 ms** (about **50.6% faster**). The result contract remained exact in all 22 parity scenarios.

The match-materialization SQL remains the largest broad-query cost after this change, and is not optimized in this round. No schema/index migration was applied or requested.

## Findings and query plans

### Match materialization

The broad `vector` query materializes 43,778 product IDs from the token prefix subquery, indexed documents and the live `wp_posts` publication/password gate. MySQL 8.4 JSON plans showed:

- `word LIKE 'vector%'` uses the existing token primary index on `(word, product_id)` as a range; estimated 92,726 token rows.
- The original broad plan scans about 43,095 document rows via `price_class`, probes `wp_posts` by primary key, then joins the grouped token-derived table via its generated `product_id` key. The plan estimates only 5% of posts pass the live gate, which does not describe the actual local published set well.
- For narrow `diwali` and `dhanteras`, the optimizer starts with the token-derived result and uses primary-key lookups into documents and posts. The same plan shape scales poorly when forced for broad terms.

I evaluated forcing the token-derived table first with `STRAIGHT_JOIN`. For broad `vector`, it scanned/materialized the estimated 92,726 prefix rows before document/post lookups. A measured run took **1,067.53 ms** for match materialization versus the ordinary plan's approximately **825 ms** median in the same profile window. It was rejected. The existing optimizer-selected join order is retained for all searches.

### Facet aggregation

The original facet plan scans the request-local matches table and probes the covering `product_facets` index by product ID. The broad plan estimates about seven facet rows per match, or 264,555 rows, then groups and filesorts category/file-type values. This is efficient for small match sets but costly for broad searches.

For broad matches, the alternate plan range-scans the existing facet primary index by `kind`, estimates 294,759 category/file-type rows, and probes the request-local match primary key. It still groups and filesorts the same rows. Its optimizer cost estimate is higher than the original plan, but bounded serial measurements were consistently faster for the very broad result sets tested.

For `diwali` (741 matches), forcing facet-first took about 249 ms versus about 13 ms with the current match-first plan. For `dhanteras` (185 matches), it took about 247 ms versus about 4 ms; for zero matches, about 614 ms versus about 0.5 ms. Those regressions are why the alternate order is restricted to the measured high-cardinality range.

## Bounded benchmark

Profiles were sequential and used the same local dataset. Match counts and sort/page settings remained constant. MySQL caches were not flushed; these are ambient/warm local samples, not cold-cache tests. Before/after timings are medians, and cache warmth varied between batches, so only the facet comparison is attributed to the join-order change. `took_ms` includes application work as well as SQL.

| Metric (`vector`, 43,778 matches) | Before | After | Notes |
|---|---:|---:|---|
| Match-materialization SQL | 957 ms (n=3, prior profile) | 609 ms (n=4) | SQL unchanged; cache-sensitive and not claimed as an improvement. |
| Facet-aggregation SQL | 1,114 ms (n=3) | 346 ms (n=4) | −68.9%; high-cardinality facet-first plan. |
| Page-selection SQL | 70.6 ms (n=3, previous optimization) | 47.7 ms (n=4) | Existing page SQL unchanged; no attribution. |
| Total handler | 1,436 ms (n=3, previous HTTP benchmark) | 948 ms (n=3) | Same benchmark helper; cache state differs, so not all of the delta is attributed to facets. |
| HTTP response | 3,359 ms (n=3, previous optimization) | 2,572 ms (n=3) | Conditions/cache warmth differ; not attributed to this SQL change. |

For `vector` + paid (43,332 matches), the facet-first result was **493.25 ms median** (n=3) versus **999.43 ms** (n=3) match-first. For `indian` (30,467 matches), the threshold keeps the original join order; the measured alternative only showed a small/inconsistent benefit, which did not justify expanding the threshold. The under-one-second warm handler target remains an aspiration; some other broad queries remain above it.

## Exact response parity

The existing `tests/fixtures/search-sql-parity-baseline.json` was preserved. Before editing the plugin, the exact baseline passed on the unchanged local index. After the facet-order change, the full **22-scenario** comparison passed again. The test excludes only documented volatile `took_ms`; it compares HTTP status and all other fields, including ordered product cards/IDs, total counts, facets and counts, prices, availability, and pagination/sort metadata.

Scenarios include broad `diwali`, `indian`, `vector`, a narrow query, zero matches, category, free/paid, landscape/portrait/square, ascending/descending price, relevance/newest/best-selling, combined filters, deep pages, special characters, clamped page, invalid page and invalid price range.

## Changes, synchronization, and rollback

- `wordpress/creative-hatti-search/creative-hatti-search.php`: select match-first or facet-first join from the already computed total (`>= 40,000` uses facet-first). Match materialization, page selection, schema, indexes, and response shape are unchanged.
- `scripts/profile-search-sql.php`: added bounded local-only scenario profiling, per-query timings, JSON plan summaries, and temporary experimental join-order switches. These switches are only in the profiling helper; production plugin logic contains only the retained threshold behavior.
- `reports/search-match-facet-final-optimization.md`: this report.
- `reports/prelaunch-focusdesk-status.md`: updated status.

The active Laragon plugin was backed up before replacing only its PHP file. Backup: `%TEMP%\creative-hatti-search-before-match-facet-optimization.php`, SHA-256 `ADD5F57554520120DDFEDB75F807DA39894F07D7369B6942E2308A60D553D0D2`. Active and repository PHP SHA-256 after synchronization: `9B3780D5F109D7A83DBBB31DE61E2FAFE6706AE983834E1C3359B6FC0121D33E`.

Rollback the active local plugin by restoring the backup over that single PHP file. Revert only the thresholded `$facet_from`/facet-query change in the repository file. No DB rollback is needed.

## Verification

- Exact API response parity: 22/22 passed after the change.
- Real local search integration: 5/5 passed, including filter/sort/pagination, orientation, validation, and Next.js rendering. Bounded 3-concurrent sample: index p50 90 ms / p95 1,542 ms; HTTP p95 3,201 ms.
- Node search unit tests: 9/9 passed.
- PHP price, orientation and source-contract tests passed; PHP 8.3 syntax checks passed.
- TypeScript, ESLint and `git diff --check` passed. Only line-ending normalization notices appeared in `git diff --check`.
- The Next.js dev server was left running; no build or browser work was needed for this server-side SQL change.

## Remaining work and recommendation

The token/document/post match materialization remains the next dominant cost. A no-schema join-order experiment was slower for broad `vector`; this round did not find another safe match-query rewrite. Further material gains likely require a reviewed schema/index or architectural change. The current facet-first switch is reversible and locally parity-verified, but the 40,000 threshold was measured against this 44,800-product catalogue and should be re-measured with staging data before rollout.

Search-performance readiness remains **Partially Complete**. Keep the local facet optimization, then proceed to staging preparation and realistic load testing. Browser testing is unnecessary for this SQL change; staging should verify API behavior and broad-query latency before launch.
