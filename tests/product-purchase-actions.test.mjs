import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire, Module } from "node:module";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../components/product/PurchasePanel.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const stubs = {
  "next/navigation": { useRouter: () => ({ push() {} }) },
  "@/app/cart/actions": { addToCart() {}, quickAddToCart() {} },
  "@/app/checkout/free/actions": { startFreeCheckout() {} },
  "@/components/cart/CartStateProvider": { useCartState: () => null },
  "@/components/ui": {
    Button: ({ children, disabled }) => React.createElement("button", { disabled }, children),
    Badge: ({ children }) => React.createElement("span", null, children), Icon: () => null,
  },
  "@/lib/constants": {}, "@/lib/routes": { routes: {} },
  "@/lib/services/cartLine": { hasCartLine: () => false },
  "@/lib/utils": { discountPercent: () => null, formatMoney: ({ amount }) => `INR ${amount / 100}` },
  "./PurchasePanel.module.css": { default: {} },
};
const panelModule = new Module("purchase-panel-test");
panelModule.require = (name) => stubs[name] ?? require(name);
panelModule._compile(compiled, "purchase-panel-test.cjs");
const { PurchasePanel } = panelModule.exports;
const license = { code: "personal", name: "Personal", description: "Test license", priceMultiplier: 1 };
const base = { id: "1", slug: "fixture", licenses: ["personal"], price: { amount: 0, currency: "INR" }, isFree: true };
const option = (id, amount, isDefault = false) => ({ id, name: `License ${id}`, price: { amount, currency: "INR" }, isDefault });
const render = (overrides = {}) => renderToStaticMarkup(React.createElement(PurchasePanel, { product: { ...base, ...overrides }, licenses: [license] }));
const buttons = (html) => [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((match) => match[1]);

test("fixed and variable free-only products render one free checkout action with license details", () => {
  const fixed = render();
  assert.deepEqual(buttons(fixed), ["Get free download", "Add to cart"]);
  assert.match(fixed, /Personal license/);
  const variable = render({ priceOptions: [option(0, 0), option(2, 0)] });
  assert.deepEqual(buttons(variable), ["Get free download", "Add to cart"]);
  assert.equal((variable.match(/type="radio"/g) ?? []).length, 2);
});
test("paid and mixed products preserve options and use the selected option's purchase action", () => {
  assert.deepEqual(buttons(render({ isFree: false, price: { amount: 9900, currency: "INR" } })), ["Add to cart", "Buy now"]);
  const mixed = [option(0, 0, true), option(2, 9900)];
  const freeSelection = render({ isFree: false, priceOptions: mixed });
  assert.deepEqual(buttons(freeSelection), ["Get free download", "Add to cart"]);
  assert.equal((freeSelection.match(/type="radio"/g) ?? []).length, 2);
  assert.match(freeSelection, /INR 0/);
  const paidSelection = render({ isFree: false, priceOptions: [option(0, 0), option(2, 9900, true)] });
  assert.deepEqual(buttons(paidSelection), ["Add to cart", "Buy now"]);
  assert.match(paidSelection, /INR 99/);
});
test("invalid or unavailable prices have no purchase action", () => {
  assert.deepEqual(buttons(render({ purchasable: false })), []);
  assert.deepEqual(buttons(render({ price: { amount: NaN, currency: "INR" } })), []);
});
