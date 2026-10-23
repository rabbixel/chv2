import assert from "node:assert/strict";
import test from "node:test";
import { getCompletedDownloadOrderReference } from "../lib/payments/checkoutDownloadAccess.mjs";

const paid = (overrides = {}) => ({
  edd_order_reference: "203266",
  order_status: "complete",
  payment_status: "captured",
  fulfilled: true,
  free_completed: false,
  ...overrides,
});

test("allows download UI after server-confirmed paid completion", () => {
  assert.equal(getCompletedDownloadOrderReference(paid()), "203266");
});

test("retains access for EDD deliverable partially refunded orders", () => {
  assert.equal(getCompletedDownloadOrderReference(paid({ order_status: "partially_refunded" })), "203266");
});

test("allows completed free order without treating it as a payment", () => {
  assert.equal(getCompletedDownloadOrderReference(paid({ order_status: "complete", payment_status: "", fulfilled: false, free_completed: true })), "203266");
});

test("does not offer downloads for captured but unfulfilled or authorized orders", () => {
  assert.equal(getCompletedDownloadOrderReference(paid({ fulfilled: false })), "");
  assert.equal(getCompletedDownloadOrderReference(paid({ payment_status: "authorized" })), "");
});

test("a query parameter or incomplete status cannot authorize download UI", () => {
  assert.equal(getCompletedDownloadOrderReference(null), "");
  assert.equal(getCompletedDownloadOrderReference(paid({ order_status: "pending" })), "");
  assert.equal(getCompletedDownloadOrderReference(paid({ edd_order_reference: "../203266" })), "");
});
