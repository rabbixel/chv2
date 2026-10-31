import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = await readFile(new URL("../components/product/ProductCard.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../components/product/ProductCard.module.css", import.meta.url), "utf8");
const grid = await readFile(new URL("../components/product/ProductGrid.module.css", import.meta.url), "utf8");

test("shared cards contain the full artwork over a neutral background", () => {
  const imageRule = styles.match(/\.image\s*\{([^}]+)\}/)?.[1] ?? "";
  assert.equal((component.match(/<ProductImageView/g) ?? []).length, 1);
  assert.match(component, /image=\{cover\}[\s\S]*?sizes=\{imageSizes\}[\s\S]*?decorative[\s\S]*?className=\{styles\.image\}/);
  assert.match(imageRule, /object-fit:\s*contain/);
  assert.match(imageRule, /object-position:\s*center/);
  assert.match(imageRule, /z-index:\s*0/);
  assert.doesNotMatch(styles, /imageBackdrop|object-fit:\s*cover/);
  // Contain preserves source proportions and keeps every pixel inside the slot.
  const slot = { width: 400, height: 300 };
  for (const [width, height] of [[200, 300], [400, 400], [1600, 900]]) {
    const scale = Math.min(slot.width / width, slot.height / height);
    const rendered = { width: width * scale, height: height * scale };
    assert.ok(rendered.width <= slot.width && rendered.height <= slot.height);
    assert.ok(Math.abs(rendered.width / rendered.height - width / height) < 1e-10);
  }
});

test("image fitting preserves the existing card slot, responsive grid, and card controls", () => {
  assert.match(styles, /aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(styles, /background-color:\s*var\(--ch-neutral-100\)/);
  assert.match(styles, /overflow:\s*hidden/);
  assert.match(styles, /\.media\s*\{[^}]*isolation:\s*isolate/s);
  assert.match(styles, /\.badges\s*\{[^}]*z-index:\s*2/s);
  assert.match(styles, /\.actions\s*\{[^}]*z-index:\s*3/s);
  assert.match(styles, /\.badges\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(styles, /\.artworkPreview \.image\s*\{\s*object-fit:\s*contain;\s*object-position:\s*center;/);
  assert.match(grid, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(grid, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(component, /<WishlistButton/);
  assert.match(component, /<QuickAddButton/);
  assert.match(component, /<span className=\{styles\.badges\}>/);
  assert.match(component, /<Link[\s\S]*?href=\{href\}/);
});
