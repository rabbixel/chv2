import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, styles, galleryStyles, purchaseStyles] = await Promise.all([
  readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/product/[slug]/page.module.css", import.meta.url), "utf8"),
  readFile(new URL("../components/product/ProductGallery.module.css", import.meta.url), "utf8"),
  readFile(new URL("../components/product/PurchasePanel.module.css", import.meta.url), "utf8"),
]);

test("product page uses wide alignment and a balanced desktop gallery and purchase split", () => {
  assert.match(page, /<Container size="wide">/);
  assert.match(styles, /grid-template-columns:\s*7fr\s+5fr/);
  assert.match(styles, /@media \(min-width:\s*1024px\)/);
  assert.ok(page.indexOf("<ProductGallery") < page.indexOf("<PurchasePanel"));
  assert.ok(page.indexOf("<ProductInfoTable") > page.indexOf("<PurchasePanel"));
  assert.doesNotMatch(page, /aria-labelledby="license"/);
});

test("product artwork remains uncropped and license information lives in the purchase panel", () => {
  assert.match(galleryStyles, /aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(galleryStyles, /object-fit:\s*contain/);
  assert.match(purchaseStyles, /\.licenseDetails/);
  assert.match(purchaseStyles, /\.licenseList/);
});
