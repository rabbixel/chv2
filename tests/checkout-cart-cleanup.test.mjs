import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkoutStatusAllowsCartCleanup, removePurchasedCartLines } from "../lib/services/checkoutCartCleanup.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("confirmed paid and free orders allow cart cleanup; unconfirmed states do not", () => {
  assert.equal(checkoutStatusAllowsCartCleanup({ fulfilled: true, free_completed: false }), true);
  assert.equal(checkoutStatusAllowsCartCleanup({ fulfilled: false, free_completed: true }), true);
  assert.equal(checkoutStatusAllowsCartCleanup({ fulfilled: false, free_completed: false }), false);
  assert.equal(checkoutStatusAllowsCartCleanup({ fulfilled: false }), false);
  assert.equal(checkoutStatusAllowsCartCleanup(null), false);
});

test("cleanup removes only purchased product and price-option quantities", () => {
  const current = [
    { product_id: 100, price_id: null, quantity: 1 },
    { product_id: 200, price_id: 2, quantity: 2 },
    { product_id: 200, price_id: 3, quantity: 1 },
    { product_id: 300, price_id: null, quantity: 1 },
  ];
  const snapshot = [
    { productId: "100", priceId: null, quantity: 1 },
    { productId: "200", priceId: 2, quantity: 1 },
  ];
  assert.deepEqual(removePurchasedCartLines(current, snapshot), [
    { product_id: 200, price_id: 2, quantity: 1 },
    { product_id: 200, price_id: 3, quantity: 1 },
    { product_id: 300, price_id: null, quantity: 1 },
  ]);
});

test("cleanup preserves a later quantity for the same line identity", () => {
  const current = [{ product_id: 200, price_id: 2, quantity: 2 }];
  const snapshot = [{ productId: "200", priceId: 2, quantity: 1 }];
  assert.deepEqual(removePurchasedCartLines(current, snapshot), [
    { product_id: 200, price_id: 2, quantity: 1 },
  ]);
});

test("repeated cleanup after the snapshot line is gone is idempotent", () => {
  const current = [
    { product_id: 300, price_id: null, quantity: 1 },
  ];
  const snapshot = [{ productId: "200", priceId: 2, quantity: 1 }];
  assert.deepEqual(removePurchasedCartLines(removePurchasedCartLines(current, snapshot), snapshot), current);
});

test("checkout action requires the HttpOnly capability and backend-confirmed completion", async () => {
  const [actions, form] = await Promise.all([
    read("../app/checkout/actions.ts"),
    read("../app/checkout/CheckoutForm.tsx"),
  ]);
  assert.match(actions, /cookieJar\.set\(CHECKOUT_CART_COOKIE/);
  assert.match(actions, /createHmac\("sha256"/);
  assert.match(actions, /timingSafeEqual\(/);
  assert.match(actions, /getCheckoutOrderStatus\(reference\)/);
  assert.match(actions, /checkoutStatusAllowsCartCleanup\(status\)/);
  assert.match(actions, /removeCheckoutItems\(lines\)/);
  assert.ok(actions.indexOf("checkoutStatusAllowsCartCleanup(status)") < actions.indexOf("removeCheckoutItems(lines)"));
  assert.match(actions, /revalidatePath\(routes\.cart\(\)\)/);
  assert.match(form, /cleanupCompletedCheckoutCart\(currentCompletedNumber\)/);
  assert.match(form, /CART_UPDATED_EVENT/);
  assert.doesNotMatch(form, /clearCart\(/);
});

test("free download card action uses the existing checkout flow without changing the cart icon", async () => {
  const card = await read("../components/product/ProductCard.tsx");
  const action = await read("../components/product/FreeDownloadAction.tsx");
  const css = await read("../components/product/ProductCard.module.css");
  assert.match(card, /<FreeDownloadAction/);
  assert.match(card, /<QuickAddButton product=\{product\} \/>/);
  assert.match(action, /startFreeCheckout\(slug, priceId\)/);
  assert.match(action, /event\.stopPropagation\(\)/);
  assert.match(action, /name="download"/);
  assert.match(action, /aria-label=\{`Download \$\{title\}`\}/);
  assert.match(action, /title="Download"/);
  assert.doesNotMatch(action, /downloadFile|requestUrl|customerDownload/);
  assert.match(css, /\.free:hover/);
  assert.match(css, /\.free:focus-visible/);
});
