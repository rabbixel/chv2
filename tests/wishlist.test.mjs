import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeWishlist,
  setWishlistItem,
  shouldSeedDemoWishlist,
  wishlistImageSource,
  wishlistProductLookup,
  wishlistViewRows,
} from "../lib/creative-hatti/wishlist.ts";

test("resolves numeric WordPress product IDs and legacy product slugs", () => {
  assert.deepEqual(wishlistProductLookup("16795"), { kind: "id", value: "16795" });
  assert.deepEqual(wishlistProductLookup("wp-16795"), { kind: "id", value: "16795" });
  assert.deepEqual(wishlistProductLookup(16795), { kind: "id", value: "16795" });
  assert.deepEqual(wishlistProductLookup("prod-bettys-cakes"), { kind: "slug", value: "bettys-cakes" });
  assert.deepEqual(wishlistProductLookup("bettys-cakes"), { kind: "slug", value: "bettys-cakes" });
  assert.equal(wishlistProductLookup("../private"), null);
});

test("prefers the WordPress original product image URL with a safe URL fallback", () => {
  assert.equal(
    wishlistImageSource({
      url: "https://creativehatti.com/wp-content/uploads/design-300x300.jpg",
      originalUrl: "https://creativehatti.com/wp-content/uploads/design.jpg",
    }),
    "https://creativehatti.com/wp-content/uploads/design.jpg",
  );
  assert.equal(wishlistImageSource({ url: "https://creativehatti.com/design.jpg" }), "https://creativehatti.com/design.jpg");
  assert.equal(wishlistImageSource({ url: "  " }), null);
});

test("does not show mock demo wishlist products to WordPress-authenticated customers", () => {
  assert.equal(shouldSeedDemoWishlist("wordpress"), false);
  assert.equal(shouldSeedDemoWishlist("mock"), true);
});

test("normalizes legacy numeric product IDs without changing saved records", () => {
  const wishlist = normalizeWishlist({
    id: "list-1",
    customerId: "customer-1",
    items: [{ productId: 16795, addedAt: "2026-01-01T00:00:00.000Z" }],
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(wishlist.items.length, 1);
  assert.equal(wishlist.items[0].productId, "16795");
});

test("keeps one visible row per saved item when product details are unavailable", () => {
  const items = [
    { productId: "16795", addedAt: "2026-01-01T00:00:00.000Z" },
    { productId: "legacy-deleted", addedAt: "2026-01-02T00:00:00.000Z" },
  ];
  const rows = wishlistViewRows(items, [{ id: "16795" }, null]);
  assert.equal(rows.length, items.length);
  assert.equal(rows.filter((row) => row.product === null).length, 1);
  assert.notEqual(rows[0].key, rows[1].key);
});

test("adds idempotently and removes only the requested wishlist record", () => {
  const initial = [{ productId: "old", addedAt: "2026-01-01T00:00:00.000Z" }];
  const added = setWishlistItem(initial, "new", true, "2026-01-02T00:00:00.000Z");
  assert.equal(added.length, 2);
  assert.equal(setWishlistItem(added, "new", true, "later").length, 2);
  assert.deepEqual(setWishlistItem(added, "new", false, ""), initial);
});
