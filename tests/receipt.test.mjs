import test from "node:test";
import assert from "node:assert/strict";
import { isReceiptStatus, receiptActionLabel, receiptDocumentTitle } from "../lib/receiptPresentation.ts";

test("paid and refunded EDD orders are identified as receipts", () => {
  for (const status of ["complete", "partially_refunded", "refunded"]) {
    assert.equal(isReceiptStatus(status), true);
    assert.equal(receiptActionLabel(status), "View Receipt");
  }
});

test("pending and other non-paid orders remain order summaries", () => {
  for (const status of ["pending", "processing", "failed", "abandoned"]) {
    assert.equal(isReceiptStatus(status), false);
    assert.equal(receiptActionLabel(status), "View Order Summary");
  }
  assert.equal(receiptDocumentTitle("order_summary"), "Order summary");
  assert.equal(receiptDocumentTitle("receipt"), "Purchase receipt");
});
