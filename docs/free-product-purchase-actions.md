# Free product purchase actions — 2026-10-28

## Root cause and comparison

The product detail transformer always returns `variable_prices`, including `[]`
for fixed products. JavaScript treats that empty array as truthy. The adapter
therefore classified fixed zero-price detail responses as non-free, while list
responses without that field correctly classified the same zero price as free.
The displayed amount and buttons consequently disagreed.

Read-only local EDD comparison:

| Product | EDD pricing | Old behavior explained |
| --- | --- | --- |
| Akshay Kumar portrait, #2858 | Fixed, `0.00`, empty variable array | List/card is free; detail misclassified |
| Bharti Singh portrait, #9968 | Fixed, `0.00`, empty variable array | Same defect; paid buttons despite zero price |
| Seth Motumal bundle, #2499 | Fixed, `3999.00` | Paid actions retained |
| Farmer Protest bundle, #11152 | Variable: #1 ₹3,999 standard, #2 ₹49 trial | Explicit paid option selection retained |

A read-only scan of published local products found no variable free-only or mixed
free/paid examples. Those cases use synthetic adapter, rendered component, API
transformer and cart tests. No product metadata was changed to manufacture cases.
The reusable audit script restricts subsequent runs to the comparison IDs and
published EDD variable-price products, with a bounded batch size.

## Rules and implementation

- Explicit EDD `single` pricing ignores stale variable metadata. Explicit
  `variable` pricing requires at least one valid option; legacy responses without
  a type use non-empty options when supplied.
- Valid amounts are nonblank numeric values, finite and nonnegative. Invalid
  options are omitted, never replaced with the product minimum or zero.
- A fixed product is free only with an explicit valid zero price. A variable
  product is free-only when every valid purchasable option has zero cost. Category
  names, Freebie labels and formatted money do not determine purchase actions.
- Valid free-only products show one primary **Get free download** action and
  retain license information and any necessary EDD option picker.
- Mixed products retain their options: the selected zero-cost option shows
  **Get free download**; a positive-cost selection keeps **Add to cart / Buy now**.
- Variable list responses now include a classification derived from all valid
  EDD amounts, so a mixed product's zero minimum does not label it wholly free.
- Missing/invalid fixed metadata is checked before EDD normalizes it to zero.
  Both API transformation and authoritative cart validation reject it. Invalid
  pricing stays disabled through availability refresh and quick-add; cards show
  **Price unavailable** rather than a fabricated free price.
- Free actions keep the existing idempotent server quick-add and EDD checkout.
  They do not clear other cart items or force a zero total for a mixed cart.

No checkout controller, checkout UI, payment fulfillment, permission, logging or
S3 signing implementation was changed.

## Simpler checkout proposal — awaiting approval

The existing action already goes directly to checkout and a completed zero-total
EDD order already skips Razorpay and shows per-file download buttons. Guests can
checkout without an account; optional purchase recovery remains email verified.

It is **not yet an email-only quick checkout**: the form and backend require a
name and phone, and the progress copy still mentions secure payment. Phone
validation also runs during quote/submit. Backend preparation unconditionally
saves validated phone metadata. Merely hiding those fields would break checkout.

Smallest proposed follow-up:

1. Use the freshly server-calculated zero total to select the simplified billing
   requirements. Keep email mandatory for guests and the authenticated email for
   members; allow an omitted name after verifying native customer/order handling.
2. Make phone optional/absent only for zero-total preparation; skip phone metadata
   writes when absent. Keep paid validation unchanged. Account for taxes and
   100%-discounted orders when determining the final total.
3. Show email plus optional name, omit phone/payment UI and payment progress copy
   for zero-total carts, and keep the existing completed-order download buttons.
4. Update frontend validation, server billing validation, idempotency payload
   handling and tests together. Continue native EDD customer/order creation,
   capabilities, entitlements, limits, logs and signed delivery. No separate lead
   store or direct S3 delivery.

This follow-up has not been implemented and requires approval of that scope.

## Files changed in this task

- `lib/creative-hatti/adapters.ts`
- `lib/types/product.ts`
- `lib/services/productService.ts`
- `app/cart/actions.ts`
- `components/product/PurchasePanel.tsx`
- `components/product/ProductCard.tsx`
- `wordpress/creative-hatti-api/includes/class-ch-product-transformer.php`
- `wordpress/creative-hatti-api/includes/class-ch-cart-controller.php`
- `tests/search.test.mjs`
- `tests/purchase-limit-ui.test.mjs`
- `tests/wordpress-cart-controller.php`
- `tests/product-purchase-actions.test.mjs` (new)
- `tests/wordpress-product-prices.php` (new)
- `scripts/audit-edd-product-prices.php` (new)
- This report (new).

Earlier download-activity task files were preserved separately in the working tree.

## Verification

- 34 relevant Node tests passed: fixed/variable free, paid, both mixed selections,
  invalid prices, cart identity/state/cleanup and checkout/download regressions.
  The new component tests render the actual PurchasePanel with mocked navigation
  and cart dependencies; they do not simulate a browser click or real checkout.
- PHP product-price DTO and cart validation suites passed, including missing
  metadata normalized by EDD to zero, explicit zero and mixed option amounts.
- Existing PHP checkout tests passed for guest and signed-in zero-total completion,
  native completion, idempotency, owner/customer association and paid regression.
- Existing payment, downloads, entitlement and guest-claim PHP suites passed.
- Lint, typecheck, production build and final `git diff --check` all passed.

No new real orders or customer records were created. The tests use isolated
fixtures; database inspection was read-only. No browser/S3 download was redeemed,
production modified, Razorpay auto-fulfillment enabled, dependency added, deployment
performed or code pushed. Production integration and browser checkout are not
claimed as newly verified.
