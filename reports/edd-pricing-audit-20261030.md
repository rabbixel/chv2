# EDD pricing audit and freebie classification

**Scope:** read-only audit of the local catalogue followed by narrowly scoped pricing-classification fixes. No product metadata, EDD orders, customer records, WordPress options, or search-index rows were changed. The Next.js page and checkout flow were left intact.

## Audit summary

EDD 3.7.2's fixed-price getter returns zero when `edd_price` is absent and variable pricing is disabled. The four reported products have that exact configuration, with no stale variable-price options. Their effective EDD price is therefore `0.00`; the former search classifier rejected them solely because the metadata row was absent.

| Published product pricing state | Count | Representative IDs |
| --- | ---: | --- |
| Fixed, explicit zero | 101 | 3017, 3026, 3030, 3031 |
| Fixed, positive | 44,329 | 2499, 2864, 2871, 2875 |
| Fixed, missing metadata; EDD effective free | 369 | 2858, 3355, 3460, 3479 |
| Fixed, missing metadata with contradictory options | 0 | — |
| Fixed, malformed/negative | 0 | — |
| Variable, all free | 0 | — |
| Variable, all paid | 1 | 11152 |
| Variable, mixed | 0 | — |
| Variable, invalid options | 0 | — |
| Other ambiguous configurations | 0 | — |
| **Published products audited** | **44,800** | — |

The local indexed search table contained 44,800 products. Its pricing class differed from the verified EDD class on 369 records: those rows were `invalid` with amount zero. All 369 should become fixed-price `free` rows on a future index refresh; amounts, sales counts, taxonomy, artwork and product records do not need modification.

## Freebies category

The local Freebies taxonomy returned 471 products.

| EDD classification | Count |
| --- | ---: |
| Fixed explicit zero | 101 |
| Fixed missing `edd_price`, effective zero | 369 |
| Fixed paid | 1 |
| Variable-price | 0 |
| Invalid or ambiguous | 0 |
| **Total** | **471** |

All 471 had a featured image. The one paid Freebies item is product **12196**; category membership alone must not imply free pricing. The 369 missing-price products currently have stale indexed classification `invalid`. Before the fix, indexed cards could show `₹0` for those rows, while the detail response omitted a class and the frontend inferred free. The 101 explicit-zero products already had indexed class `free`. Exact live rendered counts were not independently measured in a browser during this run.

Products **109070, 109066, 109062, and 109059** all have: published status; fixed pricing; no `edd_price` row; variable pricing disabled; no contradictory variable options; effective EDD price zero; Freebies/Singers/Politician taxonomy; and featured/gallery artwork. They qualify as free by pricing and meet the picker’s character-category/preview checks. After synchronization, their detail API responses report `class=free`, `amount=0`, `valid=true`. Their indexed-search responses still report `class=invalid`, `amount=0` (also observed for three other Sidhu results), confirming stale index data.

## Implemented contract

- Fixed explicit zero → `free`; fixed positive → `paid`.
- Fixed missing metadata → use EDD's effective getter only when variable mode is off and there are no non-empty contradictory variable options.
- Malformed, negative, non-finite, or contradictory prices → `invalid`.
- Variable options must all be present and valid. All zero → `free`; all positive → `paid`; zero and positive → `mixed`; any invalid option → `invalid`.
- Mixed products are never free-only; their card minimum reflects the minimum selectable option.
- Product list and detail API DTOs now return consistent `class` and `valid` fields. Existing fields remain present.
- Next.js maps verified free to “Free download”, mixed to an options-from price, and invalid to “Price unavailable”. It leaves the detail purchase panel and checkout behavior unchanged.
- Homepage Manager's existing live eligibility lookup uses the search plugin classifier, so the four products pass pricing eligibility without any product data update. Its existing character and preview checks remain in force.

## Files changed

- `wordpress/creative-hatti-api/includes/class-ch-product-transformer.php`
- `wordpress/creative-hatti-search/creative-hatti-search.php`
- `lib/creative-hatti/types.ts`
- `lib/types/product.ts`
- `lib/creative-hatti/adapters.ts`
- `components/product/ProductCard.tsx`
- `wordpress/creative-hatti-search/tests/price-classification.php`
- `tests/wordpress-product-prices.php`
- `tests/search.test.mjs`
- `reports/edd-pricing-audit-20261030.md`

## Index refresh and remaining blocker

The indexed search table is not automatically corrected by changing the classifier source. A refresh must update the 369 affected product documents so their `price_valid`, `has_free_option`, and serialized card class are consistent. This is a catalogue index write and was not run. Until it is approved and performed, those 369 products remain omitted from the indexed Free filter and can still receive stale archive labels; the 101 already-indexed explicit free items are unaffected. The Homepage Manager performs a live classification and can recognize these products after its approved plugin file is synchronized.

No catalogue-wide rebuild, incremental index write, production action, or database repair was performed. Approve a bounded 369-product index refresh separately before claiming archive/search parity is complete.

## Local plugin synchronization

The active Laragon files for API transformer and indexed search differed from the repository copies. Their prior contents were backed up under `reports/edd-pricing-active-backup-20261030/` before synchronization. The two authorized files were then copied into the active local plugins and verified byte-for-byte by SHA-256:

| Active file | Repository/active SHA-256 |
| --- | --- |
| `creative-hatti-api/includes/class-ch-product-transformer.php` | `8011F14B62926219199F36733988CFBAFBE33450CCC7587F3CC71D2822EE93F9` |
| `creative-hatti-search/creative-hatti-search.php` | `F0F3D8D818E7F6161CF55558418867158443B29DE7E640DE862476C911BD6EFD` |

The Homepage Sections plugin entry file already matched the repository copy and was not overwritten. Existing WordPress options and product metadata were preserved.

## Verification

Automated fixture tests cover EDD missing fixed metadata, explicit fixed prices, contradictory options, invalid variable rows, mixed prices, API list/detail parity, and frontend classification. Results: all 147 Node tests passed (4 integration tests skipped by their existing opt-in guards); PHP pricing-classifier, API price DTO, and Homepage Packs tests passed; changed API/search/Home Sections PHP files passed syntax checks; `npm run lint`, `npm run typecheck`, the real API-backed `npm run build`, and `git diff --check` passed. The four product records and search-index state were checked through local read-only queries. No authenticated WordPress dashboard or browser-render interaction was performed in this run.
