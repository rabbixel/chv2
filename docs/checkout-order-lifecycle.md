# Checkout order lifecycle

1. **Cart** - the browser keeps product IDs, EDD price IDs and quantities.
2. **Checkout validation** - WordPress revalidates availability and purchase
   limits, then calculates EDD prices, discounts, taxes and totals.
3. **Paid pending EDD order** - checkout stores the order, pending order items,
   billing address and EDD customer relationship. Repeated submissions with
   the same idempotency key return the same pending order.
4. **Zero-total EDD order** - when server recalculation is exactly zero,
   checkout creates the order and its items as pending, then completes it via
   EDD's `edd_update_payment_status()` API using the `manual` gateway. This
   follows EDD's native free-purchase path; EDD completion hooks update item
   status, grant authorized download entitlements and consume an eligible
   coupon. Idempotent retries return the same completed order.
5. **Paid payment initiation** - the Next.js server obtains or reuses a
   Razorpay test order from EDD and opens the official Checkout.js UI. The
   browser receives only the test Key ID and provider order details.
6. **Paid payment verification** - WordPress verifies the callback signature,
   fetches payment details from Razorpay, and checks the stored provider order,
   INR amount, currency and status. Authorized and captured states are recorded
   separately through EDD order metadata. Retries are idempotent; per-order
   database locks prevent concurrent verification races.
7. **Paid order completion and entitlements** - verification never changes the
   EDD order status or grants downloads/licenses. Paid orders remain pending;
   fulfillment is reserved for a later task after verified capture.
