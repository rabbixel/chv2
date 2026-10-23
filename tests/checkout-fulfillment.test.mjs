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
  assert.equal(getRazorpayCheckoutOutcomeCopy(response.data).message, "Payment captured and order 203266 is complete.");
  assert.match(getRazorpayCheckoutOutcomeCopy(response.data).note, /EDD confirmed order completion/);
  assert.deepEqual(getCheckoutParentNotice(response.data), { kind: "complete", title: "Order complete", message: "Payment was verified and EDD confirmed order completion." });
});

test("keeps authorized payments pending and rejects impossible or malformed states", () => {
  const authorized = parseRazorpayVerificationResponse(result({ status: "authorized" }));
  assert.equal(authorized.fulfilled, false);
  assert.match(getRazorpayCheckoutOutcomeCopy(authorized).message, /authorized but not captured/);
  assert.doesNotMatch(getRazorpayCheckoutOutcomeCopy(authorized).message, /complete/);
  const pendingFulfillment = parseRazorpayVerificationResponse(result());
  assert.match(getRazorpayCheckoutOutcomeCopy(pendingFulfillment).message, /fulfillment is pending/);
  assert.doesNotMatch(getRazorpayCheckoutOutcomeCopy(pendingFulfillment).message, /order .* is complete/);
  assert.equal(getCheckoutParentNotice(pendingFulfillment).kind, "fulfillment-pending");
  assert.equal(getCheckoutParentNotice(authorized).kind, "authorized");
  assert.equal(getCheckoutParentNotice(null), null, "a query-only checkout state cannot create a payment success notice");
  assert.throws(() => parseRazorpayVerificationResponse(result({ status: "authorized", fulfilled: true })), /could not be verified/);
  assert.throws(() => parseRazorpayVerificationResponse(result({ fulfilled: undefined })), /could not be verified/);
  assert.throws(() => parseRazorpayVerificationResponse(result({ edd_order_reference: "../other" })), /could not be verified/);
  assert.throws(() => parseRazorpayVerificationResponse({ success: false, data: result().data }), /could not be verified/);
});
