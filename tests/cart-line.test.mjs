import assert from "node:assert/strict";
import test from "node:test";
import { addCartLineOnce } from "../lib/services/cartLine.ts";

test("quick add reuses an existing fixed-price line", () => {
  const existing = [{ product_id: 42, price_id: null, quantity: 1 }];
  const result = addCartLineOnce(existing, { product_id: 42, price_id: null, quantity: 1 });
  assert.equal(result.added, false);
  assert.equal(result.lines.length, 1);
});

test("variable-price options are independent cart identities", () => {
  const first = addCartLineOnce([], { product_id: 42, price_id: 7, quantity: 1 });
  const second = addCartLineOnce(first.lines, { product_id: 42, price_id: 9, quantity: 1 });
  assert.equal(second.added, true);
  assert.deepEqual(second.lines.map(({ product_id, price_id }) => [product_id, price_id]), [[42, 7], [42, 9]]);
  assert.equal(addCartLineOnce(second.lines, { product_id: 42, price_id: 7, quantity: 1 }).added, false);
});
