# Local search performance — before/after

**Date:** 2026-10-31  
**Environment:** Local Next.js on `localhost:3000`; Laragon WordPress at `creativehatti.test`; 44,800 indexed products. No production/staging calls, index rebuild, persistent DB writes, or EDD actions.

## Summary

The slow path is confirmed inside the indexed-search SQL, not the Next.js-to-WordPress network. A broad `vector` query returned 43,778 results and spent about 2.2–2.5 seconds inside the search handler; a PHP `SAVEQUERIES` profile attributed 2.89 of 2.91 seconds to three set-based database queries. The API/network wrapper added about 0.8–1.6 seconds in these local samples. The CORS repair does not modify search. **No search performance improvement is claimed or implemented**: the relevant search plugin and its index schema are outside the current AGENTS.md backend-change scope, and no frontend change could safely remove the expensive first-query work while keeping exact counts/facets and fresh availability.

## Bounded API timings

Two serial requests per scenario; the table gives the arithmetic median of those two samples and the slowest sample. This is a small local sample, not a robust percentile or cold-database benchmark. After numbers were captured after the CORS sync; search code was unchanged. API `took_ms` is the handler-reported value. Sizes are serialized JSON bytes.

| Query / behavior | Total | Before HTTP median / max | After HTTP median / max | After handler median | Response |
|---|---:|---:|---:|---:|---:|
| `vector`, relevance | 43,778 | 3,857 / 3,869 ms | 4,082 / 4,162 ms | 2,452 ms | 19,679 B |
| `indian`, relevance | 30,467 | 3,726 / 3,766 ms | 3,550 / 3,611 ms | 1,928 ms | 19,231 B |
| `diwali`, relevance | 741 | 1,612 / 1,645 ms | 1,622 / 1,651 ms | 71 ms | 17,813 B |
| no-match query | 0 | 1,536 / 1,544 ms | 1,555 / 1,555 ms | 6 ms | 214 B |
| free-only | 470 | 1,588 / 1,595 ms | 1,595 / 1,599 ms | 56 ms | 18,156 B |
| paid-only | 44,330 | 3,605 / 3,697 ms | 3,770 / 3,800 ms | 2,213 ms | 19,251 B |
| square + newest | 37,573 | 3,752 / 3,880 ms | 3,954 / 3,975 ms | 2,409 ms | 17,515 B |
| `vector`, newest, page 500 | 43,778 | 3,592 / 3,648 ms | 4,094 / 4,231 ms | 2,409 ms | 19,210 B |
| best-selling browse | 44,800 | 3,382 / 3,420 ms | 3,743 / 3,776 ms | 2,088 ms | 19,737 B |
| `diwali` + social-media + landscape + paid + price ascending | 112 | No equivalent valid baseline; earlier baseline category combination returned 0 | 1,603 / 1,624 ms | 49 ms | 17,376 B |

No semantic changes were made, so after result counts, sort order, deep-page handling and payload sizes remain as returned by the same endpoint. Timing differences are noise/host variance; the broad-query before/after values do not show a performance win.

### Next.js cache behavior

`lib/cache.ts` sets search revalidation to 60 seconds; product availability is separately refreshed with a no-store request. Before the CORS fix, local SSR requests measured:

- `vector`: 7,685 ms first request, then 1,832 and 1,818 ms.
- `indian`: 5,729 ms first request, then 1,868 and 1,817 ms.
- `diwali`: 1,913, 1,849 and 1,772 ms.

This shows the existing Next data cache reduces repeated exact-query cost, while fresh availability work remains. It is existing behavior, not a change from this task. The real API integration test after the CORS sync rendered `/search?q=diwali` successfully (HTTP 200, test duration about 3.5 s). No numeric browser LCP was measured.

## Database/query investigation

A single read-only PHP CLI request invoked the real REST search handler with `SAVEQUERIES` enabled. It reported 35 SQL statements for `vector`; 2,909.7 ms total DB time and 2,913 ms handler time. The three dominant statements were:

| Statement | Time |
|---|---:|
| Materialize matching IDs from token/document/post joins into the request-local MEMORY table | 1,396.67 ms |
| Count category and file-type facets across the full match set | 975.48 ms |
| Select/order the current page from all matched IDs | 517.06 ms |
| All other statements combined | about 20 ms |

`EXPLAIN FORMAT=JSON` (not `EXPLAIN ANALYZE`) showed:

- Prefix-token search uses the token table primary BTREE index on `(word, product_id)` with a range on `word LIKE 'vector%'`; estimated 92,726 token rows.
- The document scan estimates about 43,095 rows and the live publication check joins `wp_posts` by primary key.
- The broad match set has 43,778 products. The facet plan estimates 264,555 joined facet rows and about 322 MB read for aggregation; the page query sorts the matched set before applying `LIMIT/OFFSET`.
- Existing `price_class`, `published`, `sales`, `title`, `product`, and `product_facets` indexes are present and are selected in parts of the plans. This does not prove the current index set is optimal; no index was added or altered.

The response is not slow because of a huge network payload: 24-card broad-search responses were about 19–20 KB. No repeated full-catalogue API request or N+1 pattern dominated the measured profile. Search computes exact total/facets for the full result set before pagination, which preserves current semantics but makes broad terms expensive.

## Changes and safety

- No search ranking, SQL, category/facet count, filter, pricing, availability, pagination or index code was changed.
- No index rebuild or schema change was performed.
- `wordpress/creative-hatti-search` was left untouched because AGENTS.md limits backend changes to the custom API/homepage integration scope, and an index/query change needs a separate reviewed change with semantic and rollback testing.
- CORS change is isolated to `wordpress/creative-hatti-api` and had no search-path code changes.

## Recommended next step for search

If approval expands backend scope, run `EXPLAIN ANALYZE` in a controlled local/staging replica for the broad token match, facet aggregation and order-by queries; evaluate a semantics-preserving join/aggregation or reversible covering-index change; then rerun the same filter/sort/count suite. Do not apply a migration based only on estimated `EXPLAIN` rows. A full search-index rebuild is not indicated by these measurements.

## Verification

- Search integration against the local API: all 5 tests passed, including full filter/orientation/sort/pagination input validation and Next.js result rendering.
- Bounded timings: 11 scenarios x 2 sequential requests before and 10 scenarios x 2 after; no uncontrolled concurrency. An earlier official integration timing sample used 3 concurrent reads and reported HTTP p95 4,507 ms after this run.
- Typecheck, lint and `git diff --check` passed.
- No production build was run; the active dev server's shared `.next` output was not overwritten.

## Rollback

There is no search-performance code or data change to roll back. To roll back the separate local CORS change, restore `class-ch-api.php` from the pre-sync backup named `creative-hatti-cors-backup-class-ch-api.php` in the user temp directory; restore the repository change by reverting only the CORS hunks in that file and the accompanying CORS README/test, preserving all other work.

## Final verification rerun (after the last CORS header adjustment)

The real local integration suite passed 5/5 with both API and storefront URLs configured. Its bounded 3-concurrent timing sample reported index p50 98 ms / p95 2,731 ms and HTTP p95 4,452 ms. This agrees with the earlier 4.3–4.5 s broad-query concern; the CORS adjustment did not change search SQL or query results.
