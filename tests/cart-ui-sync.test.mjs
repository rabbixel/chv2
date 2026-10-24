import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("one cart provider spans the header and all route content", async () => {
  const [layout, grid, provider, header] = await Promise.all([
    read("../app/layout.tsx"),
    read("../components/product/ProductGrid.tsx"),
    read("../components/cart/CartStateProvider.tsx"),
    read("../components/layout/CartCountBadge.tsx"),
  ]);

  assert.match(layout, /<CartStateProvider>[\s\S]*?<SiteHeader\s*\/>[\s\S]*?\{children\}[\s\S]*?<\/CartStateProvider>/);
  assert.doesNotMatch(grid, /<CartStateProvider/);
  assert.match(provider, /getQuickAddCartState\(\)/);
  assert.match(provider, /\[pathname, refresh\]/);
  assert.match(provider, /cartItems\) setItems\(detail\.cartItems\)/);
  assert.match(header, /useCartState\(\)/);
  assert.match(header, /cartState\?\.items\?\.length \?\? cookieCount/);
});

test("product detail state follows the selected product and EDD price option", async () => {
  const [panel, action, quickAdd] = await Promise.all([
    read("../components/product/PurchasePanel.tsx"),
    read("../app/cart/actions.ts"),
    read("../components/product/QuickAddButton.tsx"),
  ]);

  assert.match(panel, /useCartState\(\)/);
  assert.match(panel, /hasCartLine\(cartItems, product\.id, priceId\)/);
  assert.match(panel, /Already in your cart/);
  assert.match(panel, /disabled=\{pending \|\| cartLoading\}/);
  assert.match(panel, /syncCart\(result\)/);
  assert.match(action, /cartItems: cart\.items\.map/);
  assert.match(quickAdd, /cartItems\?\.filter\(\(item\) => item\.productId === product\.id\)/);
  assert.match(quickAdd, /item\.priceId === priceId/);
});

test("cart removal updates shared state and count from the server result", async () => {
  const [remove, countBadge, service] = await Promise.all([
    read("../components/cart/CartRemoveButton.tsx"),
    read("../components/layout/CartCountBadge.tsx"),
    read("../lib/services/cartService.ts"),
  ]);

  assert.match(remove, /removeFromCart\(itemKey\)/);
  assert.match(remove, /detail: result/);
  assert.match(countBadge, /cartState\?\.items\?\.length \?\? cookieCount/);
  assert.match(service, /CART_COUNT_COOKIE/);
});

