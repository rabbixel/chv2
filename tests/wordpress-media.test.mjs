import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWordPressMediaUrl } from "../lib/creative-hatti/media.ts";

test("normalizes known WordPress thumbnail URLs to attachment originals", () => {
  assert.equal(
    normalizeWordPressMediaUrl(
      "https://www.creativehatti.com/wp-content/uploads/2021/04/asset-300x300.jpg",
    ),
    "https://www.creativehatti.com/wp-content/uploads/2021/04/asset.jpg",
  );
});

test("preserves ordinary image filenames and untrusted remote URLs", () => {
  assert.equal(
    normalizeWordPressMediaUrl(
      "https://www.creativehatti.com/wp-content/uploads/2021/04/asset-small.jpg",
    ),
    "https://www.creativehatti.com/wp-content/uploads/2021/04/asset-small.jpg",
  );
  assert.equal(
    normalizeWordPressMediaUrl("https://example.invalid/uploads/asset-300x300.jpg"),
    "https://example.invalid/uploads/asset-300x300.jpg",
  );
});
