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

test("free download card action is a compact, keyboard-focusable button", () => {
  const action = cardCss.match(/\.free\s*\{[^}]*\}/s)?.[0] ?? "";
  assert.match(cardSource, /<FreeDownloadAction/);
  assert.match(action, /display:\s*inline-flex/);
  assert.match(action, /width:\s*var\(--ch-space-10\)/);
  assert.match(action, /height:\s*var\(--ch-space-10\)/);
  assert.match(action, /flex-shrink:\s*0/);
  assert.doesNotMatch(action, /transform\s*:/);
  assert.match(action, /background-color:\s*var\(--ch-color-surface\)/);
  assert.match(action, /color:\s*var\(--ch-brand-900\)/);
  assert.match(action, /border:\s*1px solid var\(--ch-brand-200\)/);
  assert.match(action, /border-radius:\s*var\(--ch-radius-sm\)/);
  assert.match(cardCss, /\.free:hover:not\(:disabled\)\s*\{[^}]*background-color:\s*var\(--ch-brand-50\);[^}]*border-color:\s*var\(--ch-brand-400\)/s);
  assert.match(cardCss, /\.free:focus-visible/);
  assert.match(cardCss, /\.free:disabled/);
});

test("Free badge uses brand blues instead of the success-green variant", () => {
  assert.match(cardSource, /product\.isFree && \([\s\S]*?<Badge variant="brand" size="sm" className=\{styles\.freeBadge\}>\s*Free/);
  assert.match(cardCss, /\.badges \.freeBadge\s*\{[^}]*background-color:\s*var\(--ch-brand-50\);[^}]*border-color:\s*var\(--ch-brand-200\);[^}]*color:\s*var\(--ch-brand-900\)/s);
});

test("free ProductCard places a single-line title and fixed-width Download action together", async () => {
  const action = await readFile(new URL("../components/product/FreeDownloadAction.tsx", import.meta.url), "utf8");
  assert.match(cardSource, /className=\{cn\(styles\.body, product\.isFree && styles\.freeBody\)\}/);
  assert.match(cardSource, /<div className=\{styles\.freeInfoRow\}>\s*<div className=\{styles\.freeTextGroup\}>\s*<p className=\{styles\.kicker\}>\{kicker\}<\/p>\s*\{titleElement\}\s*<\/div>\s*<FreeDownloadAction[\s\S]*?\/>\s*<\/div>/);
  assert.match(cardSource, /title=\{product\.title\} aria-label=\{product\.title\}/);
  const row = cardCss.match(/\.freeInfoRow\s*\{[^}]*\}/s)?.[0] ?? "";
  const textGroup = cardCss.match(/\.freeTextGroup\s*\{[^}]*\}/s)?.[0] ?? "";
  const actionWrapper = cardCss.match(/\.freeAction\s*\{[^}]*\}/s)?.[0] ?? "";
  assert.match(row, /display:\s*grid/);
  assert.match(row, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+var\(--ch-space-10\)/);
  assert.match(row, /align-items:\s*center/);
  assert.match(row, /column-gap:\s*var\(--ch-space-3\)/);
  assert.match(row, /min-width:\s*0/);
  assert.doesNotMatch(row, /min-height|position|transform|margin/);
  assert.match(textGroup, /display:\s*flex/);
  assert.match(textGroup, /flex-direction:\s*column/);
  assert.match(textGroup, /gap:\s*var\(--ch-space-1\)/);
  assert.match(textGroup, /min-width:\s*0/);
  assert.match(cardCss, /\.freeBody\s*\{[^}]*padding:\s*var\(--ch-space-3\)/s);
  assert.match(cardCss, /\.freeTitle\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap/s);
  assert.doesNotMatch(cardCss.match(/\.freeTitle\s*\{[^}]*\}/s)?.[0] ?? "", /align-self|margin|transform/);
  assert.match(cardCss, /\.free\s*\{[^}]*flex-shrink:\s*0/s);
  assert.match(actionWrapper, /display:\s*flex/);
  assert.doesNotMatch(actionWrapper, /position|align-self|justify-self|transform/);
  assert.match(action, /aria-label=\{`Download \$\{title\}`\}/);
  assert.match(action, /title="Download"/);
  assert.match(action, /<Icon name="download" size=\{18\} \/>/);
  assert.doesNotMatch(action, /<span>Download<\/span>/);
});
