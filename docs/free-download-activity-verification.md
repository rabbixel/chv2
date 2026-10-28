# Task 05: free downloads and activity tracking

Verified 2026-10-28 against the repository and local Laragon WordPress installation.

## Result

Completed for the local implementation. No download-flow or tracking defect was
confirmed, so application code, EDD, and S3 delivery were preserved. No duplicate
logger is needed. Production parity and completed S3 transfers were not tested.

## Existing behavior

- Free checkout creates a zero-total, manual-gateway EDD order and completes it
  through the native status API. Idempotent retries reuse the order.
- Checkout downloads require an active order capability; registered orders also
  require their owner. Free guest checkout does not require a WordPress account.
- Account downloads resolve the authenticated user's EDD customer, completed or
  partially refunded orders, deliverable items, and price-specific files.
- Custom paid orders require verified payment association; pending and refunded
  entitlements remain blocked. Guest recovery still requires email verification.
- Both download controllers call `edd_get_download_file_url()` with the purchased
  order item, order email and file key. They return an EDD token URL, not a direct
  S3 URL, and neither writes a download log.

## Native activity semantics

Installed EDD is 3.7.2; active Amazon S3 extension is 2.4.2. EDD's
`includes/download-functions.php` and `includes/process-download.php` establish:

| Information | Native behavior |
| --- | --- |
| Product/file/order/price | `product_id`, `file_id`, `order_id`, `price_id` on each log |
| Identity | Order's `customer_id`; guest/registered identity resolved through the order/customer, plus request IP and user agent |
| Timestamp | Native log table's `date_created` (also `date_modified` and UUID) |
| Filename | `file_name` log metadata when available |
| Count | Native log count scoped by product, file, order and price |
| Permissions/limits | Checked at redemption; not stored as a permission snapshot on each log |
| Invalid/expired/unauthorized | Rejected before the logging branch; no separate rejected-request outcome field |
| Concurrent limit overflow | Native post-insert slot check deletes the excess log before rejecting |
| Successful transfer | Not established by an EDD log or a signed S3 URL |

URL issuance does not log. Signed-link redemption validates TTL, token, native
file limits and file entitlement. The custom full-refund access filter still runs.
EDD then resolves the file through `edd_requested_file`; the S3 extension signs it
and selects redirect delivery. EDD records an authorized delivery attempt before
redirecting, without observing the subsequent S3 response or completed transfer.
S3 errors, interrupted transfers and reuse of the same S3 URL cannot be classified
from these EDD rows. Direct S3 URL reuse does not pass through EDD's counter again.
No AWS access-log configuration or extra completion tracking was added.

The earlier backend audit's proposed manual `edd_record_download_in_log()` step
must **not** be added when returning native EDD links: redemption already records
the event, and logging at issuance would duplicate/inflate counts.

## Read-only database evidence

`scripts/audit-edd-download-activity.php` reads settings, native schema, aggregate
associations and 12 recent records, without issuing or redeeming URLs.

- 16,619 order-associated free events across 14,971 orders, including 11,362
  guest-order events; all match their orders' customer IDs.
- 1,209 paid events across 626 orders; all match their orders' customer IDs.
- All 12 recent records match an order item by product and price and have matching
  customer IDs. They include free product 12347/order 203255 and paid product
  250744/order 203266, with complete parent orders.
- Repeated product 12347 events are separate native rows with distinct timestamps.
- Global file limit is zero (unlimited); native login-to-download is disabled.
  Native guest-checkout restriction is enabled, while the custom API's existing
  zero-total capability flow implements its own guest checkout. No setting changed.

These are local database observations, not a new production audit. Historical
counts are evidence of recorded activity, not evidence of completed file transfers.

## Validation and changes

- Added the read-only audit script above.
- Added `tests/edd-native-download-activity.php`: 24 assertions executing selected
  installed EDD functions with in-memory order/log dependencies. Covers free/paid
  repeated authorization, token tampering, expiry, limits, exact entitlement args,
  native log associations and filename metadata. Access-gate and concurrent-limit
  cleanup ordering are source assertions. No database or network is used.
- Updated `tests/checkout-download-failures.test.mjs`: stale recovery-message
  wording assertion now matches existing copy and checks the recovery-page hint.
  This was a test mismatch, not a customer-facing defect.
- 13 frontend download tests passed. Existing PHP checkout, payment, downloads,
  download-entitlement and guest-claim suites passed.
- Lint, typecheck, configured API-mode production build and `git diff --check`
  passed. The build retried the unrelated `/collections` route after timeout
  warnings, then completed with exit code zero. No mock-mode rerun was needed.

No new orders, payments, download redemptions, entitlement changes, historical
record edits, AWS operations, deployments or pushes were performed. Razorpay
auto-fulfillment was not enabled. The pre-existing generated `next-env.d.ts`
difference disappeared when Next.js regenerated it during the build.

Not reverified: a fresh browser checkout, end-to-end S3 transfer, production plugin
versions/settings, and real concurrent-request behavior. Existing customer links
were deliberately not redeemed to avoid consuming limits or changing activity.

Run the PHP audit/test with Laragon PHP, optionally passing the WordPress root to
the audit or the installed EDD `includes` directory to the isolated test. The
isolated test depends on installed EDD source and is not a portable replacement for
EDD's own test suite.
