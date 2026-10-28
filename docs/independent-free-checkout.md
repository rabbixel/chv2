# Independent free download checkout

Implemented locally on 2026-10-28. No deployment or production changes.

## Cause and approach

The old free action called `quickAddToCart()` and navigated to regular checkout.
Regular checkout intentionally submits the whole persistent cart. The free
product was therefore combined with unrelated paid and free items.

The primary free action now creates a scoped checkout session for one selected
item. It never reads, replaces, empties, restores or writes the regular cart.
The secondary ghost-style **Add to cart** action still uses the existing cart
system. Mixed products expose the independent action only for a zero-cost option.
Paid product actions are unchanged.

This extends the existing CheckoutService and WordPress checkout controller.
There is no separate customer store, order processor, payment integration or
download implementation.

## Isolation and authorization

- `startFreeCheckout()` is a Next server action, preserving the existing action
  origin/CSRF boundary. It resolves fresh product data and selected EDD pricing
  server-side and obtains a native checkout quote for exactly that item.
- `/checkout/free/[sessionId]` shows only that selection, a zero total, and the
  existing required name, email, phone and terms fields. Tax-location fields use
  the backend quote's tax setting. No Razorpay component, payment fields or
  discount input is mounted in this flow.
- An HttpOnly, SameSite=Strict selection cookie holds the product/option and a
  stable random retry key. A separate random route ID scopes the cookie path.
  Production cookies are Secure. Neither cookie nor client totals authorize a
  free price: fresh product resolution and native backend validation do that.
- The existing quote/prepare requests include `independent_free: true`. The
  backend requires one validated item, quantity one, authoritative zero price,
  no coupon, and zero calculated subtotal, tax and total. Client prices are never
  submitted by CheckoutService. It continues the existing locked purchase-limit
  checks, EDD customer resolution and zero-total manual order completion.
- Free retry keys have a separate backend scope bound to the existing payload
  digest. Changed guest email cannot create a second order with the same key;
  mismatched billing is rejected. A signed-in order cannot replay as another
  user or guest. Regular checkout's scope/digest behavior remains unchanged.
- Existing sessions may reach preparation after availability has changed so EDD
  can replay their own completed orders after a final unit was consumed. New
  orders still face the existing authoritative purchase-limit checks.
- Each free session uses its own path-scoped download authorization cookie.
  Regular checkout's authorization cookie and signed cart-cleanup snapshot are
  neither overwritten nor consumed. Independent preparation creates no cleanup
  snapshot. Both the form effect and server cleanup action exclude this flow.
- Completion reuses the normal CheckoutForm confirmation and file controls at
  the scoped free URL with `?completed=...`. Refresh reads the same capability
  and native order state. File requests keep native EDD entitlement, logging and
  S3 signing; no direct S3 URL is minted by the frontend.

## Verification

40 relevant Node tests passed. The new isolation tests execute the actual free
session functions and checkout server actions against in-memory cookie/service
dependencies. The component tests render the actual purchase/checkout components
with navigation, input and payment-widget stubs. They are not browser tests.

| Requested scenario | Evidence |
| --- | --- |
| ₹2,000 paid cart stays ₹2,000 | Guest/member action tests compare the complete cart before/after and assert zero regular-cart reads/mutations |
| Three free items remain after a fourth independent item | Same isolation test with three existing free lines |
| Mixed cart unchanged | Same isolation test with paid and free lines |
| Three regular free products in one order | Server-action and PHP controller tests retain every line and complete one zero-total EDD order |
| Regular mixed checkout stays paid | Server-action and PHP tests retain the full cart and pending custom Razorpay preparation |
| Invalid/paid independent selection | Session tests reject invalid prices/options; PHP rejects paid items despite client zero values, coupon attempts and multi-item submissions before creating an order |
| Sold-out/limited free item | Session rejects unavailable starts; PHP tests reject unavailable items and enforce final-unit reservations for new orders |
| Refresh/retry/duplicate submission | Cookie retry key stays stable; action/PHP replay creates no second order; PHP rejects changed-email payloads; limited-order replay remains supported |
| Guest and signed-in checkout | Both action and PHP tests cover independent completion and native customer ownership |
| Completion/download entitlement | Existing payment, download, entitlement and guest-claim suites pass; scoped confirmation reads are covered by action tests |

PHP suites passed: product prices, cart, checkout (including the new independent
cases), payment controller, downloads controller, download entitlements, guest
claims, and 24 installed EDD activity assertions with in-memory dependencies.
Native EDD logging, S3 delivery and entitlement code were not changed.

Lint, typecheck, production build and final `git diff --check` passed.

## Files changed in this task

- `components/product/PurchasePanel.tsx`
- `lib/routes.ts`
- `lib/services/index.ts`
- `lib/services/checkoutService.ts`
- `lib/services/freeCheckoutService.ts` (new)
- `app/checkout/free/actions.ts` (new)
- `app/checkout/free/[sessionId]/page.tsx` (new)
- `app/checkout/actions.ts`
- `app/checkout/CheckoutForm.tsx`
- `wordpress/creative-hatti-api/includes/class-ch-checkout-controller.php`
- `tests/independent-free-checkout.test.mjs` (new)
- `tests/free-download-flow.test.mjs`
- `tests/product-purchase-actions.test.mjs`
- `tests/wordpress-checkout-controller.php`
- This report (new).

Prior task changes in the working tree were preserved.

## Limits and operational scope

The free session and native checkout authorization/idempotency windows are two
days. After expiration, return to the product or use existing verified purchase
recovery. A new explicit free session is a new checkout attempt; retries within
one session reuse its order. Changed billing on a completed session is rejected
rather than silently creating another order.

No real orders, customers, historical records, prices, AWS objects or settings
were changed. Razorpay auto-fulfillment was not enabled. No dependencies were
added, and nothing was pushed or deployed. The frontend and backend code changes
need to be applied together when deployment is separately authorized.

Not newly verified: browser cookie/path behavior end to end, live WordPress order
creation from the new route, actual concurrent database requests, or an S3 file
transfer. Tests use controlled fixtures to avoid consuming customer entitlements
or creating unnecessary orders. An EDD delivery log or issued URL is not proof
that an S3 transfer completed.
