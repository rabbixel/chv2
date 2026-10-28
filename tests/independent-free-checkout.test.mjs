import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire, Module } from "node:module";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
async function load(path, stubs) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiledModule = new Module(path);
  compiledModule.require = (name) => name in stubs ? stubs[name] : require(name);
  compiledModule._compile(compiled, path);
  return compiledModule.exports;
}

const zero = { amount: 0, currency: "INR" };
const product = { id: "9968", slug: "free-portrait", status: "active", price: zero, priceValid: true,
  purchasable: true, images: [], licenses: ["personal"], title: "Free portrait" };
let currentProduct = product;
const jar = new Map();
const attributes = new Map();
const cookieApi = { cookies: async () => ({ get: (key) => jar.has(key) ? { value: jar.get(key) } : undefined,
  set: (key, value, options) => { jar.set(key, value); attributes.set(key, options); } }) };
const free = await load("../lib/services/freeCheckoutService.ts", {
  "server-only": {}, "next/headers": cookieApi,
  "./productService": { getProductService: () => ({ getProductForQuickAdd: async () => currentProduct }) },
  "./checkoutService": { getCheckoutService: () => ({ quote: async () => ({ total: zero, subtotal: zero, tax: zero, taxesEnabled: false }) }) },
});
let regularCart;
let cartReads = 0;
let removals = 0;
let signedIn = false;
const prepared = new Map();
const requests = [];
const services = {
  ...free,
  isWordPressAuthEnabled: () => signedIn,
  getAuthService: () => ({ getCurrentIdentity: async () => ({ user: { firstName: "Member", lastName: "Buyer", email: "member@example.test" } }) }),
  getCartService: () => ({
    getSessionCart: async () => { cartReads++; return regularCart; },
    removeCheckoutItems: async () => { removals++; throw new Error("Unexpected cart cleanup"); },
  }),
  getCheckoutService: () => ({
    quote: async (input) => { requests.push(input); return { total: input.cart.total }; },
    prepare: async (input) => {
      requests.push(input);
      if (!prepared.has(input.idempotencyKey)) {
        const id = String(100 + prepared.size);
        prepared.set(input.idempotencyKey, { id, number: id, status: input.cart.total.amount === 0 ? "complete" : "pending",
          total: input.cart.total, created: true, payment_authorization_token: "a".repeat(64) });
      }
      return prepared.get(input.idempotencyKey);
    },
  }),
};
const bridge = async (path, { body }) => path === "status"
  ? { success: true, data: { edd_order_reference: String(body.order_id), order_status: "complete", payment_status: "", fulfilled: false, free_completed: true } }
  : { success: true, data: { order: String(body.order_id), items: [{ order_item_id: 7, title: "Free portrait", files: [{ key: "1", name: "portrait.zip" }] }] } };
const actions = await load("../app/checkout/actions.ts", {
  "next/headers": cookieApi, "next/cache": { revalidatePath() {} },
  "@/lib/auth": { assertSameOriginRequest: async () => {} },
  "@/lib/services": services, "@/lib/services/freeCheckoutService": free,
  "@/lib/services/guestSafeRequest": { guestSafeApiFetch: bridge },
  "@/lib/api/endpoints": { apiEndpoints: { razorpayOrderStatus: "status", razorpayOrderDownloads: "downloads" } },
  "@/lib/routes": { routes: { cart: () => "/cart", checkout: () => "/checkout" } },
  "@/lib/validation/phone": { normalizePhoneNumber: (phone) => phone, isValidPhoneNumber: () => true },
  "@/lib/payments/razorpayVerificationResponse.mjs": {}, "@/lib/payments/downloadFailure.mjs": { downloadFailureKind: () => "authorization" },
  "@/lib/api/client": { ApiError: class extends Error {} },
  "@/lib/services/checkoutCartCleanup.mjs": { checkoutStatusAllowsCartCleanup: () => true },
});
function form(key) {
  const data = new FormData();
  for (const [name, value] of Object.entries({ terms: "accepted", idempotencyKey: key, fullName: "Guest Buyer", email: "guest@example.test", phone: "+919876543210", country: "IN", region: "" })) data.set(name, value);
  return data;
}
const line = (id, amount) => ({ productId: String(id), priceId: null, quantity: 1, unitPrice: { amount, currency: "INR" }, lineTotal: { amount, currency: "INR" } });
const cart = (lines) => ({ id: "regular", currency: "INR", items: lines, itemCount: lines.length,
  total: { amount: lines.reduce((sum, item) => sum + item.lineTotal.amount, 0), currency: "INR" } });

test("independent guest/member checkout leaves paid, free and mixed carts and normal authorization untouched", async () => {
  for (const member of [false, true]) for (const lines of [[line(1, 200000)], [line(2, 0), line(3, 0), line(4, 0)], [line(1, 200000), line(2, 0)]]) {
    signedIn = member; currentProduct = product; cartReads = 0;
    regularCart = cart(lines);
    const before = JSON.stringify(regularCart);
    jar.set("ch_payment_auth", "regular-auth"); jar.set("ch_checkout_cart", "regular-snapshot");
    const id = await free.createFreeCheckoutSession(product.slug, null);
    const selection = await free.getFreeCheckoutSelection(id);
    const countBefore = prepared.size;
    const result = await actions.preparePendingOrder(form(selection.idempotencyKey), id);
    assert.equal(result.order?.status, "complete");
    assert.equal(result.order?.total.amount, 0);
    const last = requests.at(-1);
    assert.equal(last.independentFree, true);
    assert.deepEqual(last.cart.items.map((item) => item.productId), [product.id]);
    assert.equal(last.billing.email, member ? "member@example.test" : "guest@example.test");
    assert.equal(prepared.size, countBefore + 1);
    const refreshed = await free.getFreeCheckoutSelection(id);
    assert.equal(refreshed.idempotencyKey, selection.idempotencyKey);
    assert.deepEqual(await actions.preparePendingOrder(form(refreshed.idempotencyKey), id), result);
    assert.equal(prepared.size, countBefore + 1);
    assert.equal((await actions.getCheckoutOrderStatus(result.order.number, id)).free_completed, true);
    assert.equal((await actions.getCompletedOrderDownloads(result.order.number, id)).downloads.items[0].order_item_id, 7);
    assert.equal(await actions.cleanupCompletedCheckoutCart(result.order.number, id), null);
    assert.equal(jar.get("ch_payment_auth"), "regular-auth");
    assert.equal(jar.get("ch_checkout_cart"), "regular-snapshot");
    assert.equal(attributes.get(`ch_free_payment_${id}`).path, `/checkout/free/${id}`);
    assert.equal(attributes.get(`ch_free_payment_${id}`).httpOnly, true);
    assert.equal(JSON.stringify(regularCart), before);
    assert.equal(cartReads, 0);
    assert.equal(removals, 0);
  }
});
test("free session rejects paid, invalid, sold-out and unselected options without cart access", async () => {
  const countBefore = prepared.size;
  for (const overrides of [{ price: { amount: 200000, currency: "INR" } }, { priceValid: false }, { soldOut: true }, { purchasable: false }, { priceOptions: [] }]) {
    currentProduct = { ...product, ...overrides };
    await assert.rejects(free.createFreeCheckoutSession(product.slug, null));
  }
  currentProduct = { ...product, priceOptions: [{ id: 0, price: zero }, { id: 2, price: { amount: 9900, currency: "INR" } }] };
  await assert.rejects(free.createFreeCheckoutSession(product.slug, 2));
  const id = await free.createFreeCheckoutSession(product.slug, 0);
  assert.equal((await free.resolveFreeCheckoutCart(await free.getFreeCheckoutSelection(id))).items[0].priceId, 0);
  assert.ok((await actions.preparePendingOrder(form("00000000-0000-4000-8000-000000000000"), id)).error);
  await assert.rejects(free.getFreeCheckoutSelection("tampered"));
  assert.equal(prepared.size, countBefore);
});
test("regular multi-free and mixed checkout still submits the full cart and stores normal snapshot", async () => {
  signedIn = false;
  for (const lines of [[line(2, 0), line(3, 0), line(4, 0)], [line(1, 200000), line(2, 0)]]) {
    regularCart = cart(lines);
    const result = await actions.preparePendingOrder(form(require("node:crypto").randomUUID()));
    assert.equal(result.order.status, regularCart.total.amount === 0 ? "complete" : "pending");
    assert.equal(requests.at(-1).cart.items.length, lines.length);
    assert.equal(requests.at(-1).independentFree, false);
    assert.notEqual(jar.get("ch_checkout_cart"), "regular-snapshot");
  }
});

test("independent checkout renders one item, zero total, required identity fields and no payment UI", async () => {
  const { CheckoutForm } = await load("../app/checkout/CheckoutForm.tsx", {
    "next/link": ({ children, href }) => React.createElement("a", { href }, children),
    "@/components/ui": {
      Button: ({ children, type, disabled }) => React.createElement("button", { type, disabled }, children),
      Input: ({ name, required, value }) => React.createElement("input", { name, required, defaultValue: value }),
    },
    "@/lib/routes": { routes: { terms: () => "/terms", privacy: () => "/privacy" } },
    "@/lib/utils": { formatMoney: ({ amount }) => `INR ${amount / 100}` },
    "@/lib/payments/checkoutParentNotice.mjs": { getCheckoutParentNotice: () => null },
    "@/lib/payments/downloadFailure.mjs": { downloadFailureMessage: () => "Unavailable" },
    "@/lib/validation/phone": { isValidPhoneNumber: () => true },
    "./RazorpayCheckout": { RazorpayCheckout: () => React.createElement("div", null, "Payment widget") },
    "./actions": actions, "@/lib/constants": {}, "./page.module.css": { default: {} },
  });
  currentProduct = product;
  const isolatedCart = await free.resolveFreeCheckoutCart({ slug: product.slug, priceId: null });
  const html = renderToStaticMarkup(React.createElement(CheckoutForm, {
    cart: isolatedCart, initialQuote: { currency: "INR", subtotal: zero, total: zero, tax: zero, discount: zero, taxesEnabled: false },
    initialName: "", initialEmail: "", initialPhone: "+91 ", signedIn: false,
    idempotencyKey: "11111111-1111-4111-8111-111111111111", freeSessionId: "22222222-2222-4222-8222-222222222222",
    initialOrderStatus: null, initialOrderDownloads: null, initialDownloadsError: null,
  }));
  assert.match(html, /Free portrait/);
  assert.match(html, /INR 0/);
  assert.match(html, /Complete Free Order/);
  assert.doesNotMatch(html, /Payment widget|Secure payment|Razorpay|name="discountCode"/);
  for (const name of ["fullName", "email", "phone"]) assert.match(html, new RegExp(`<input(?=[^>]*name="${name}")(?=[^>]*required)[^>]*>`));
});
