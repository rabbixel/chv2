import assert from "node:assert/strict";
import { Module, createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { jsx } from "react/jsx-runtime";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../components/product/PurchasePanel.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;

let hookValues;
let hookIndex;
let tasks;
let addCalls;
let freeCalls;
let routeCalls;
const reactStub = {
  useState(initial) {
    const index = hookIndex++;
    if (!(index in hookValues)) hookValues[index] = typeof initial === "function" ? initial() : initial;
    return [hookValues[index], (value) => { hookValues[index] = typeof value === "function" ? value(hookValues[index]) : value; }];
  },
  useTransition() {
    return [false, (callback) => { tasks.push(Promise.resolve(callback())); }];
  },
};
const Button = ({ children, ...props }) => jsx("button", { type: "button", ...props, children });
const stubs = {
  react: reactStub,
  "next/navigation": { useRouter: () => ({ push: (path) => routeCalls.push(path) }) },
  "@/app/cart/actions": { addToCart: async (...args) => { addCalls.push(args); return { itemCount: 0, cartItems: [] }; } },
  "@/app/checkout/free/actions": { startFreeCheckout: async (...args) => { freeCalls.push(args); return { url: "/checkout/free" }; } },
  "@/components/cart/CartStateProvider": { useCartState: () => ({ items: [], setItems() {} }) },
  "@/components/ui": { Button, Badge: ({ children }) => jsx("span", { children }), Icon: () => jsx("span", {}) },
  "@/lib/constants": { CART_UPDATED_EVENT: "cart-updated" },
  "@/lib/routes": { routes: { checkout: () => "/checkout", cart: () => "/cart", customize: () => "/customize" } },
  "@/lib/services/cartLine": { hasCartLine: () => false },
  "@/lib/utils": { discountPercent: () => null, formatMoney: ({ amount }) => `INR ${amount / 100}` },
  "./PurchasePanel.module.css": { default: new Proxy({}, { get: (_target, key) => String(key) }) },
};
const panelModule = new Module("product-license-purchase-test");
panelModule.require = (name) => stubs[name] ?? require(name);
panelModule._compile(compiled, "product-license-purchase-test.cjs");
const { PurchasePanel } = panelModule.exports;

const licenses = [
  { code: "personal", name: "Personal", description: "For personal projects", priceMultiplier: 1, allowedUses: ["Personal use"], seats: 1 },
  { code: "commercial", name: "Commercial", description: "For commercial work", priceMultiplier: 2, allowedUses: ["Client projects"], seats: 3 },
];
const options = [
  { id: 41, name: "Standard", price: { amount: 9900, currency: "INR" }, isDefault: true },
  { id: 72, name: "Extended", price: { amount: 19900, currency: "INR" }, isDefault: false },
];
const product = {
  id: "product-1", slug: "test-art", title: "Test Art", licenses: ["personal", "commercial"],
  price: { amount: 9900, currency: "INR" }, priceOptions: options, isFree: false,
  soldOut: false, purchasable: true, isCustomizable: false,
};

function flatten(node, output = []) {
  if (node === null || node === undefined || typeof node === "boolean") return output;
  if (Array.isArray(node)) { node.forEach((child) => flatten(child, output)); return output; }
  if (typeof node !== "object") return output;
  if (typeof node.type === "function") return flatten(node.type(node.props), output);
  output.push(node);
  flatten(node.props?.children, output);
  return output;
}

function render(overrides = {}, licenseOverride = licenses) {
  hookIndex = 0;
  return flatten(PurchasePanel({ product: { ...product, ...overrides }, licenses: licenseOverride }));
}

function reset() {
  hookValues = [];
  hookIndex = 0;
  tasks = [];
  addCalls = [];
  freeCalls = [];
  routeCalls = [];
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
}

test("selected EDD option ID reaches Add to Cart and Buy Now while all license details remain visible", async () => {
  reset();
  let nodes = render();
  const inputs = nodes.filter((node) => node.type === "input" && node.props.type === "radio");
  assert.deepEqual(inputs.map((input) => input.props.value), [41, 72]);
  assert.equal(inputs.find((input) => input.props.checked).props.value, 41);
  assert.match(nodes.map((node) => node.props?.children).join(" "), /Personal|Commercial/);
  inputs.find((input) => input.props.value === 72).props.onChange();

  nodes = render();
  const selected = nodes.find((node) => node.type === "input" && node.props.type === "radio" && node.props.checked);
  assert.equal(selected.props.value, 72);
  nodes.find((node) => node.type === "button" && node.props.children === "Add to cart").props.onClick();
  await Promise.all(tasks);
  assert.deepEqual(addCalls.at(-1), [product.id, "personal", 72]);

  tasks = [];
  nodes = render();
  nodes.find((node) => node.type === "button" && node.props.children === "Buy now").props.onClick();
  await Promise.all(tasks);
  assert.deepEqual(addCalls.at(-1), [product.id, "personal", 72]);
  assert.deepEqual(routeCalls, ["/checkout"]);
});

test("free checkout uses the selected EDD option ID and single-license products show a summary", async () => {
  reset();
  let nodes = render({ isFree: true, priceOptions: options.map((option) => ({ ...option, price: { ...option.price, amount: 0 } })) });
  const freeInputs = nodes.filter((node) => node.type === "input" && node.props.type === "radio");
  freeInputs.find((input) => input.props.value === 72).props.onChange();
  nodes = render({ isFree: true, priceOptions: options.map((option) => ({ ...option, price: { ...option.price, amount: 0 } })) });
  nodes.find((node) => node.type === "button" && node.props.children === "Get free download").props.onClick();
  await Promise.all(tasks);
  assert.deepEqual(freeCalls, [[product.slug, 72]]);

  const single = render({ priceOptions: undefined, licenses: ["personal"] }, [licenses[0]]);
  assert.ok(single.some((node) => node.type === "strong" && [].concat(node.props.children).join("") === "Personal license"));
  assert.equal(single.filter((node) => node.type === "input" && node.props.type === "radio").length, 0);
});

test("license selection keeps its default, updates the displayed fixed price, and reaches cart", async () => {
  reset();
  let nodes = render({ priceOptions: undefined, price: { amount: 10000, currency: "INR" } });
  let inputs = nodes.filter((node) => node.type === "input" && node.props.type === "radio");
  assert.deepEqual(inputs.map((input) => input.props.value), ["personal", "commercial"]);
  assert.equal(inputs.find((input) => input.props.checked).props.value, "personal");
  inputs.find((input) => input.props.value === "commercial").props.onChange();

  nodes = render({ priceOptions: undefined, price: { amount: 10000, currency: "INR" } });
  assert.ok(nodes.some((node) => node.type === "p" && node.props.children === "INR 200"));
  nodes.find((node) => node.type === "button" && node.props.children === "Add to cart").props.onClick();
  await Promise.all(tasks);
  assert.deepEqual(addCalls, [[product.id, "commercial", null]]);
});
