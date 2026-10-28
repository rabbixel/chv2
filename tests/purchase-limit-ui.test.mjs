import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("WordPress availability reaches the product model", async () => {
  const [apiTypes, model, adapter] = await Promise.all([
    read("../lib/creative-hatti/types.ts"),
    read("../lib/types/product.ts"),
    read("../lib/creative-hatti/adapters.ts"),
  ]);

  assert.match(apiTypes, /availability\?: \{ available: boolean; sold_out: boolean; remaining: number \| null \}/);
  assert.match(model, /soldOut\?: boolean/);
  assert.match(model, /purchasable\?: boolean/);
  assert.match(adapter, /soldOut: apiProduct\.availability\?\.sold_out === true/);
});

test("product cards and product pages suppress purchase actions when sold out", async () => {
  const [card, quickAdd, detail, cardStyles] = await Promise.all([
    read("../components/product/ProductCard.tsx"),
    read("../components/product/QuickAddButton.tsx"),
    read("../components/product/PurchasePanel.tsx"),
    read("../components/product/QuickAddButton.module.css"),
  ]);

  assert.match(card, /product\.soldOut[\s\S]*?Sold Out/);
  assert.match(quickAdd, /product\.soldOut[\s\S]*?disabled=\{pending \|\| isUnavailable/);
  assert.match(quickAdd, /Sold Out: \$\{product\.title\}/);
  assert.match(cardStyles, /\.button:has\(span\)/);
  assert.match(detail, /if \(product\.soldOut\)[\s\S]*?Sold Out[\s\S]*?return \(/);
  assert.match(detail, /if \(product\.purchasable === false[\s\S]*?Temporarily unavailable/);
  assert.ok(detail.indexOf("if (product.soldOut)") < detail.indexOf("if (product.isFree && zeroValueOptions)"));
});

test("availability is refreshed independently from cached product content", async () => {
  const [service, endpoint, productPage, homePage, controller] = await Promise.all([
    read("../lib/services/productService.ts"),
    read("../lib/api/endpoints.ts"),
    read("../app/product/[slug]/page.tsx"),
    read("../app/page.tsx"),
    read("../wordpress/creative-hatti-api/includes/class-ch-products-controller.php"),
  ]);

  assert.match(endpoint, /availability: "\/products\/availability"/);
  assert.match(service, /cache: "no-store"/);
  assert.match(service, /await refreshProductAvailability\(paginated\.items\)/);
  assert.match(service, /soldOut: state\.sold_out, purchasable: product\.priceValid !== false && state\.available/);
  assert.match(service, /await refreshProductAvailability\(paginated\.items\)/);
  assert.match(controller, /Cache-Control.*private, no-store/);
  assert.match(controller, /count\( \$raw_ids \) > 48/);
  assert.match(productPage, /await connection\(\)/);
  assert.match(homePage, /await connection\(\)/);
});
