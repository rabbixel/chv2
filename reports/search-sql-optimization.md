# Indexed Search SQL Optimization

**Date:** 2026-10-31 (Asia/Kolkata)  
**Environment:** Local Laragon WordPress (`creativehatti.test`), PHP 8.3.33, MySQL 8.4, 44,800 indexed products. Local only. No production/staging requests, persistent database changes, index rebuild, or EDD actions.

## Result

One SQL-only optimization was retained in `creative-hatti-search`: choose the requested page using narrow product IDs and relevance values, then retrieve the serialized card payload only for those page IDs. The API response, ordering, filters, counts, facets, prices, availability, and pagination remained byte-for-structure equivalent across 22 captured scenarios (volatile `took_ms` excluded).

No persistent index, schema, product or WordPress option change was made. No new index is proposed. The active Laragon plugin PHP file was backed up before synchronizing only that file; the active and repository copies have identical SHA-256 hashes.

## Root cause and query plans

The broad `vector` search still spends most time materializing 43,778 matches and aggregating facets. The latest pre-change profile showed three dominant statements: match insertion around 0.96 s, facets around 0.99 s, and page selection around 0.38–0.47 s. The page statement selected `d.card` (a `LONGTEXT` serialized card) in the same query that sorted the full match set.

The new page query performs the sort/limit in a derived table projecting only `product_id` and `relevance`, then joins the 24 selected IDs back to the document table to read cards. Sort expressions and the `product_id DESC` tie-break are preserved in both stages. The query plan for the broad search shows:

- Inner page selection examines about 43,095 rows using the existing `sales` index and match-table primary key, then filesorts the narrow ID/relevance rows.
- The derived page has 24 rows.
- Card payload retrieval uses the documents primary key for those 24 rows only (estimated ~25 KB read for cards), rather than carrying `LONGTEXT` through the sort.
- No schema/index change was needed.

The match insertion and facet aggregation are still the largest bottlenecks. The current candidate did not alter those SQL statements.

## Bounded before/after measurements

Three sequential PHP CLI profiles of the real REST handler were collected before and after the query change. The same local `vector`, relevance, page 1, 24-item query and dataset were used. The sample is intentionally serial; it is not a load test.

| Measurement | Before median | After median | Change |
|---|---:|---:|---:|
| Page-selection SQL | 398 ms | 70.6 ms | -82.3% |
| Handler duration | 2,426 ms | 2,065 ms | -14.9% |
| Total SQL duration (`SAVEQUERIES`) | 2,434 ms | 2,096 ms | -13.9% |

Before handler samples: 2,426 / 2,378 / 2,460 ms. After samples: 2,065 / 2,075 / 1,994 ms. Match insertion medians remained about 957 ms before and 960 ms after; facet aggregation remained about 984 ms before and 990 ms after. Their small differences are normal run variance, not regressions attributable to the change.

An additional three-request HTTP sample after the change returned 43,778 results at 4,335 / 3,359 / 3,017 ms (median 3,359 ms; handler median 1,436 ms in those warmer requests). The earlier audit recorded a 4,082 ms two-sample HTTP median for `vector`. These HTTP samples differ in cache/host warmth and should not be used to claim the entire HTTP delta came from this SQL change; the controlled SQL/handler profiles are the more comparable measure. The broad-search target below one second is not met.

## Exact response parity

`tests/fixtures/search-sql-parity-baseline.json` contains the complete normalized response for 22 scenarios: broad terms, narrow/zero-result queries, category, free/paid, all orientations, both price sorts, relevance/newest/best-selling, combined filters, deep page, special characters, clamped page, invalid page, and invalid price range. Only `took_ms` is removed before comparison; HTTP status and all other fields are compared structurally.

The real local parity test passed all 22 scenarios after the change. This checks totals, ordered IDs/cards, availability, prices, facets/counts, sort and pagination metadata, and validation responses against the same local index snapshot.

## Files changed

- `wordpress/creative-hatti-search/creative-hatti-search.php` — defer card JSON retrieval until after page selection.
- `tests/fixtures/search-sql-parity-baseline.json` — exact local response baseline.
- `tests/search-sql-parity.test.mjs` — opt-in exact response parity test.
- `scripts/capture-search-sql-baseline.mjs` — serial baseline capture utility.
- `scripts/profile-search-sql.php` — local-only `SAVEQUERIES`/EXPLAIN profile helper.
- `scripts/benchmark-indexed-search.mjs` — bounded serial HTTP benchmark helper.
- `reports/search-sql-optimization.md` — this report.
- `reports/prelaunch-focusdesk-status.md` — status update.

## Active local plugin synchronization and rollback

Only `C:\laragon\www\creativehatti\wp-content\plugins\creative-hatti-search\creative-hatti-search.php` was synchronized. Before copying, the active file was backed up to `%TEMP%\creative-hatti-search-before-sql-optimization.php` (backup SHA-256 `1DE5D436F55E083CB0986D139B6E2129B395BE249D6BEA15E195AEC66526044F`). The synchronized active file and repository file both have SHA-256 `ADD5F57554520120DDFEDB75F807DA39894F07D7369B6942E2308A60D553D0D2`.

To roll back the local runtime, copy that exact backup over the active plugin PHP file. To roll back the repository change, revert only the page query hunk in the search plugin source. The fixture and scripts are audit/test artifacts and do not affect runtime.

## Verification

- Exact parity: 22/22 real local endpoint scenarios passed.
- Existing real API integration: 5/5 passed, including catalogue search, input validation, orientation/filter composition, a bounded 3-concurrent timing sample, and Next.js search rendering. The concurrent sample reported index p50 92 ms / p95 1,801 ms and HTTP p95 3,425 ms.
- Existing Node search tests: 9/9 passed.
- PHP classifier/orientation/search contract tests: passed (12 price fixtures; orientation and pre-pagination/source contracts).
- PHP syntax: plugin file passed PHP 8.3 CLI lint.
- Query plan: MySQL 8.4 `EXPLAIN FORMAT=JSON` captured for the new page query; no `EXPLAIN ANALYZE` was needed to verify the bounded plan.
- PHP classifier/orientation/SQL contract tests, Node search tests, TypeScript, ESLint and `git diff --check`: passed. `git diff --check` emitted only existing LF-to-CRLF normalization notices for modified worktree files; no whitespace errors.
- No browser test was required; the change is confined to the server-side WordPress SQL query.

## Remaining opportunity and completion status

The next candidates would target the prefix-token match materialization and full category/file-type facet aggregation. Changing either is higher risk because they define complete filtering/facet behavior; this task does not justify changing them without separate query-plan experiments and parity/performance evidence. No persistent database index should be added without separately documented justification and approval.

The local page-selection optimization is safe to retain based on exact parity and the measured page-query improvement. The broader Focus Desk search-performance work remains **Partially Complete**: local SQL work is complete for this bounded optimization, but the under-one-second broad target is not met and production/staging-like load verification remains outstanding.
