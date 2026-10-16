# Checkout order lifecycle

The checkout preparation endpoint stops at a pending EDD order. It does not
initiate payment, complete an order, or grant download or license entitlements.

1. **Cart** — the browser keeps product IDs, EDD price IDs and quantities.
2. **Checkout validation** — WordPress revalidates availability and purchase
   limits, then calculates EDD prices, discounts, taxes and totals.
3. **Pending EDD order** — checkout stores the order, pending order items,
   billing address and EDD customer relationship. Repeated submissions with
   the same idempotency key return the same pending order.
4. **Payment initiation** — not implemented yet. No gateway is assigned and
   no card details are collected or stored.
5. **Verified payment** — not implemented yet. Only a future server-verified
   payment flow may move a pending order forward.
6. **Completed order** — not set by checkout preparation. EDD completion hooks
   are not invoked here.
7. **Download entitlement** — not granted by checkout preparation. Delivery
   must follow verified payment and completed order status.

Zero-total carts are rejected by preparation and require a separate explicit
completion flow; they are not treated as paid.
