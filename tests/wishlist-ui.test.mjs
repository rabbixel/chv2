import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("guest wishlist feedback is a readable, dismissible responsive toast", async () => {
  const [button, styles] = await Promise.all([
    read("../components/product/WishlistButton.tsx"),
    read("../components/product/WishlistButton.module.css"),
  ]);

  assert.match(button, /createPortal\([\s\S]*?document\.body/);
  assert.match(button, /role="alert" aria-live="assertive"/);
  assert.match(button, /aria-label="Dismiss wishlist message"/);
  assert.match(button, /Sign in to save/);
  assert.match(styles, /\.notice\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(styles, /width:\s*min\(28rem, calc\(100vw - 2 \* var\(--ch-space-5\)\)\)/);
  assert.match(styles, /\.message\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(styles, /@media \(max-width: 480px\)/);
});

test("guest sign-in returns to the product page from both cards and detail", async () => {
  const [button, card, detail] = await Promise.all([
    read("../components/product/WishlistButton.tsx"),
    read("../components/product/ProductCard.tsx"),
    read("../app/product/[slug]/page.tsx"),
  ]);

  assert.match(button, /routes\.login\(returnTo \?\? routes\.accountWishlist\(\)\)/);
  assert.match(card, /returnTo=\{href\}/);
  assert.match(detail, /returnTo=\{routes\.product\(product\.slug\)\}/);
});

test("single-product and card hearts share persistent server actions and sync state", async () => {
  const [button, actions, service, card, detail] = await Promise.all([
    read("../components/product/WishlistButton.tsx"),
    read("../app/account/actions.ts"),
    read("../lib/services/wishlistService.ts"),
    read("../components/product/ProductCard.tsx"),
    read("../app/product/[slug]/page.tsx"),
  ]);

  assert.match(button, /setWishlistItemAction\(productId, nextSaved\)/);
  assert.match(button, /setWishlisted\(result\.saved\)/);
  assert.match(card, /<WishlistButton\s+key=\{product\.id\}/);
  assert.match(detail, /<WishlistButton\s+key=\{product\.id\}/);
  assert.match(button, /WISHLIST_COUNT_EVENT/);
  assert.match(button, /if \("error" in result\) \{[\s\S]*?return;[\s\S]*?setWishlisted\(result\.saved\)/);
  assert.match(actions, /error\.status === 401/);
  assert.match(actions, /requiresAuth: true/);
  assert.match(service, /getWordPressSessionBridgeHeaders\(\)/);
  assert.match(service, /cache: "no-store"/);
  assert.match(card, /<WishlistButton/);
  assert.match(detail, /<WishlistButton/);
  assert.match(button, /setWishlisted\(result\.saved\);[\s\S]*?dispatchEvent/);
});

