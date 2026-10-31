# Bounded EDD pricing index refresh

**Environment:** local Laragon WordPress only. No EDD product data, prices, metadata, orders, customers, WordPress options, or production records were changed.

## Fresh scope check

After reading `AGENTS.md` and `reports/edd-pricing-audit-20261030.md`, a fresh read-only comparison examined all 471 published products assigned to the Freebies category against the corrected active `CH_Indexed_Search::product_price_classification()` result and their current indexed document rows.

| Result | Count |
| --- | ---: |
| Freebies products | 471 |
| Correctly classified free by EDD | 470 |
| Correctly classified paid by EDD | 1 |
| Missing index rows | 0 |
| Stale pricing rows (`invalid` → `free`) | **369** |
| Other pricing mismatches | 0 |

The stale set contained exactly 369 unique rows. Each had current `price=0`, `price_valid=0`, `has_free_option=0`, `has_paid_option=0`, card `price.class=invalid`; each fresh EDD classification was fixed-price free at zero. Product 12196 was excluded from the update and remains the one paid Freebies item.

## Backup and update

Before writing, all 369 complete search-document rows (including their pre-update card JSON and non-pricing fields) were exported to [documents-before.json](freebie-search-index-backup-20261030/documents-before.json).

- Rows backed up: 369
- Backup size: 428,954 bytes
- SHA-256: `ed10ea29608f903f902590200cc578afcc3701299dee11657bc51ea66adcaf7d`
- Updated rows: **369** (single transaction; committed only after a 369-row verification)

Only these search index fields changed for the affected IDs: `price`, `price_valid`, `has_free_option`, `has_paid_option`, and `card.price.class` / `card.price.amount`. The 369 stored amounts remained zero; valid/free flags became `1/1`, paid-option stayed `0`, and card class became `free`. Titles, sales counts, categories, images, token rows and facet rows were not touched.

## Post-update verification

- A fresh EDD-to-index comparison found 0 pricing mismatches across all 471 Freebies products.
- A post-refresh parity check compared all 369 backed-up IDs across the EDD classifier, the active API transformer, and the refreshed index: all 369 are `free`, zero-valued, valid; 0 parity errors.
- Indexed search for “sidhu” returns the four requested IDs as `free`, amount 0. The `avail=free` query includes all four; `avail=paid` does not.
- The Freebies category availability totals are 470 free, 1 paid, 471 overall. Product 12196 appears in the paid result as `paid`, INR 99, and not in free results.
- The rendered local Next.js archive at `/category/freebies?q=sidhu` includes all four product slugs; after each slug the rendered HTML includes “Free download” and no “Price unavailable” in the following product-card markup.
- The Homepage Manager's `product_summary(..., true)` eligibility logic reports IDs 109070, 109066, 109062 and 109059 as `eligible=true`, `price_class=free`, with no rejection reason. Product 12196 remains ineligible with reason “Product is paid.” This exercised the actual picker eligibility method; the authenticated admin screen was not browser-tested.

## Regression checks

Search pricing Node tests, API pricing DTO PHP tests, Homepage Packs PHP tests, lint, typecheck and `git diff --check` all passed. The authenticated WordPress admin screen itself was not browser-tested; picker eligibility was checked through its actual PHP summary method.
