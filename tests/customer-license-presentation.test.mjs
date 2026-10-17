import test from "node:test";
import assert from "node:assert/strict";
import { licenseOrderLinkId } from "../lib/customerLicensePresentation.ts";

test("only validated EDD 3 orders receive order-detail navigation", () => {
  assert.equal(licenseOrderLinkId("order", "203245"), "203245");
  assert.equal(licenseOrderLinkId("legacy_payment", "11169"), null);
  assert.equal(licenseOrderLinkId("unavailable", "11169"), null);
  assert.equal(licenseOrderLinkId("order", null), null);
});
