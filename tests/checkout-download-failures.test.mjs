import assert from "node:assert/strict";
import test from "node:test";
import { downloadFailureKind, downloadFailureMessage } from "../lib/payments/downloadFailure.mjs";

test("classifies authorization and capability failures separately from outages", () => {
  for (const status of [401, 403, 404]) assert.equal(downloadFailureKind(status), "authorization");
  for (const status of [429, 500, 503, undefined]) assert.equal(downloadFailureKind(status), "temporary");
});

test("uses customer-safe messages without exposing backend details", () => {
  assert.match(downloadFailureMessage("authorization"), /browser where you placed the order/);
  assert.match(downloadFailureMessage("authorization"), /purchase recovery page/);
  assert.match(downloadFailureMessage("temporary"), /temporarily unavailable/);
  assert.doesNotMatch(downloadFailureMessage("authorization"), /capability|token|payment|order id/i);
});
