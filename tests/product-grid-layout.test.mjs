import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const gridCss = await readFile(
  new URL("../components/product/ProductGrid.module.css", import.meta.url),
  "utf8",
);
const cardCss = await readFile(
  new URL("../components/product/ProductCard.module.css", import.meta.url),
  "utf8",
);
const cardSource = await readFile(
  new URL("../components/product/ProductCard.tsx", import.meta.url),
  "utf8",
);

test("shared product grid responds to available width and resets list indentation", () => {
  assert.match(gridCss, /container:\s*product-grid\s*\/\s*inline-size/);
  assert.match(gridCss, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(gridCss, /margin:\s*0/);
  assert.match(gridCss, /padding:\s*0/);
  assert.match(gridCss, /list-style:\s*none/);
  assert.match(gridCss, /@container product-grid \(min-width:\s*22rem\)[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(gridCss, /@container product-grid \(min-width:\s*48rem\)[\s\S]*?repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(gridCss, /@container product-grid \(min-width:\s*64rem\)[\s\S]*?repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(gridCss, /columns:\s*\d/);
});

test("product cards keep aligned heights and a consistent catalogue image ratio", () => {
  assert.match(cardCss, /\.card\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/s);
  assert.match(cardCss, /\.media\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*3/s);
  assert.match(cardCss, /\.artworkPreview \.media\s*\{[^}]*aspect-ratio:\s*1/s);
  assert.doesNotMatch(cardSource, /aspectRatio:\s*`\$\{cover\.width\}/);
});
