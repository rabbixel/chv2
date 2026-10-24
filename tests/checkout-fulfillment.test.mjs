import assert from "node:assert/strict";
import test from "node:test";
import { getRazorpayCheckoutOutcomeCopy, parseRazorpayVerificationResponse } from "../lib/payments/razorpayVerificationResponse.mjs";
import { getCheckoutParentNotice } from "../lib/payments/checkoutParentNotice.mjs";

const result = (overrides = {}) => ({
  success: true,
  data: {
    status: "captured",
    verified: true,
    fulfilled: false,
    edd_order_reference: "203266",
    ...overrides,
  },
});

test("accepts a verified captured payment when EDD fulfillment is pending", () => {
  assert.deepEqual(parseRazorpayVerificationResponse(result()), result().data);
});

test("accepts backend-confirmed fulfillment for a captured payment", () => {
  const response = result({ fulfilled: true });
  assert.deepEqual(parseRazorpayVerificationResponse(response), response.data);
  assert.equal(getRazorpayCheckoutOutcomeCopy(response.data).message, "Payment received and order 203266 is complete.");
  assert.match(getRazorpayCheckoutOutcomeCopy(response.data).note, /Your order is complete/);
  assert.deepEqual(getCheckoutParentNotice(response.data), { kind: "complete", title: "Order complete", message: "Your payment is confirmed and your order is complete." });
});

test("keeps authorized payments pending and rejects impossible or malformed states", () => {
  const authorized = parseRazorpayVerificationResponse(result({ status: "authorized" }));
  assert.equal(authorized.fulfilled, false);
  assert.match(getRazorpayCheckoutOutcomeCopy(authorized).message, /approved but hasn’t been confirmed yet/);
  assert.doesNotMatch(getRazorpayCheckoutOutcomeCopy(authorized).message, /complete/);
  const pendingFulfillment = parseRazorpayVerificationResponse(result());
  assert.match(getRazorpayCheckoutOutcomeCopy(pendingFulfillment).message, /Order completion is pending/);
  assert.doesNotMatch(getRazorpayCheckoutOutcomeCopy(pendingFulfillment).message, /order .* is complete/);
  assert.equal(getCheckoutParentNotice(pendingFulfillment).kind, "fulfillment-pending");
  assert.equal(getCheckoutParentNotice(authorized).kind, "authorized");
  assert.equal(getCheckoutParentNotice(null), null, "a query-only checkout state cannot create a payment success notice");
  assert.throws(() => parseRazorpayVerificationResponse(result({ status: "authorized", fulfilled: true })), /couldn’t confirm your payment/);
  assert.throws(() => parseRazorpayVerificationResponse(result({ fulfilled: undefined })), /couldn’t confirm your payment/);
  assert.throws(() => parseRazorpayVerificationResponse(result({ edd_order_reference: "../other" })), /couldn’t confirm your payment/);
  assert.throws(() => parseRazorpayVerificationResponse({ success: false, data: result().data }), /couldn’t confirm your payment/);
});
