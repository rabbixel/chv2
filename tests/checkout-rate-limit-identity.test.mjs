import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire, Module } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

async function loadProxy() {
  const source = await readFile(new URL("../proxy.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let forwarded;
  let cookie;
  class NextResponse {
    static next(options) {
      forwarded = options.request.headers.get("x-ch-checkout-rate-token");
      return { cookies: { set(name, value, options) { cookie = { name, value, options }; } } };
    }
  }
  const mod = new Module("proxy.ts");
  mod.require = (name) => name === "next/server" ? { NextResponse } : require(name);
  mod._compile(compiled, "proxy.ts");
  return { proxy: mod.exports.proxy, config: mod.exports.config, get forwarded() { return forwarded; }, get cookie() { return cookie; } };
}

async function loadOriginGuard() {
  const source = await readFile(new URL("../lib/auth.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let current = {};
  const mod = new Module("lib/auth.ts");
  mod.require = (name) => name === "next/headers" ? { headers: async () => new Headers(current) }
    : name === "next/navigation" ? { redirect() {} }
      : name === "@/lib/routes" ? { routes: { account: () => "/account", login: () => "/login" } }
        : name === "@/lib/services" ? { getAuthService() { return {}; } }
          : name === "@/lib/types" ? {} : require(name);
  mod._compile(compiled, "lib/auth.ts");
  return { assertSameOriginRequest: mod.exports.assertSameOriginRequest, setHeaders(value) { current = value; } };
}

async function loadCheckoutService(rateToken) {
  const source = await readFile(new URL("../lib/services/checkoutService.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let apiCalls = 0;
  let forwarded;
  const mod = new Module("checkoutService.ts");
  mod.require = (name) => name === "server-only" ? {}
    : name === "next/headers" ? { headers: async () => new Headers(rateToken ? { "x-ch-checkout-rate-token": rateToken } : {}) }
      : name === "@/lib/api/endpoints" ? { apiEndpoints: { checkoutQuote: "/quote", checkoutPrepare: "/prepare" } }
        : name === "./guestSafeRequest" ? { guestSafeApiFetch: async (_path, options) => {
            apiCalls++;
            forwarded = options.headers;
            return { data: { currency: "INR", subtotal: { amount: 0 }, discount: { amount: 0 }, tax: { amount: 0 }, total: { amount: 0 }, taxes_enabled: false } };
          } }
          : name === "./apiMode" ? { isLiveApiEnabled: () => true } : require(name);
  mod._compile(compiled, "checkoutService.ts");
  return { service: mod.exports.getCheckoutService(), get apiCalls() { return apiCalls; }, get forwarded() { return forwarded; } };
}

test("checkout proxy replaces spoofed headers, signs a browser token, and reuses only valid cookies", async () => {
  const priorSecret = process.env.CH_AUTH_BRIDGE_SECRET;
  process.env.CH_AUTH_BRIDGE_SECRET = "s".repeat(40);
  try {
    const harness = await loadProxy();
    const request = (cookie) => ({
      headers: new Headers({ "x-ch-checkout-rate-token": "spoofed" }),
      cookies: { get: () => cookie ? { value: cookie } : undefined },
      nextUrl: { protocol: "http:" },
    });
    harness.proxy(request(undefined));
    const first = harness.cookie.value;
    assert.match(first, /^[a-f0-9]{64}\.[a-f0-9]{64}$/);
    assert.equal(harness.forwarded, first, "proxy overwrites the incoming header with its signed token");
    assert.equal(harness.cookie.options.httpOnly, true);
    assert.equal(harness.cookie.options.path, "/");
    assert.equal(harness.cookie.options.secure, false);

    harness.proxy(request(first));
    assert.equal(harness.forwarded, first, "a valid signed cookie keeps the same rate-limit identity");
    harness.proxy(request(`${"a".repeat(64)}.${"b".repeat(64)}`));
    assert.notEqual(harness.forwarded, `${"a".repeat(64)}.${"b".repeat(64)}`, "an invalid signed cookie is replaced");
  } finally {
    if (priorSecret === undefined) delete process.env.CH_AUTH_BRIDGE_SECRET;
    else process.env.CH_AUTH_BRIDGE_SECRET = priorSecret;
  }
});

test("checkout proxy injects its signed rate token on every shared ProductCard listing route", async () => {
  const { config } = await loadProxy();
  for (const path of [
    "/",
    "/category/:path*",
    "/collections",
    "/collections/:path*",
    "/free-downloads",
    "/new-arrivals",
    "/popular",
    "/product/:path*",
    "/checkout/:path*",
  ]) {
    assert.ok(config.matcher.includes(path), `${path} must pass through the checkout rate-token proxy`);
  }
});

test("missing proxy token is the local source of the invalid checkout session message", async () => {
  const checkout = await loadCheckoutService(undefined);
  await assert.rejects(
    checkout.service.quote({ cart: { items: [{ productId: "12", priceId: null, quantity: 1, available: true }] }, billing: { country: "IN", region: "" } }),
    /Your checkout session is invalid\. Refresh the page and try again\./,
  );
  assert.equal(checkout.apiCalls, 0, "failure occurs before a WordPress API request");

  const token = `${"a".repeat(64)}.${"b".repeat(64)}`;
  const recovered = await loadCheckoutService(token);
  await recovered.service.quote({ cart: { items: [{ productId: "12", priceId: null, quantity: 1, available: true }] }, billing: { country: "IN", region: "" } });
  assert.equal(recovered.apiCalls, 1);
  assert.equal(recovered.forwarded["X-CH-Checkout-Rate-Token"], token);
});

test("state-changing account, cart, checkout, and free-checkout actions require explicit same-origin validation", async () => {
  const guarded = {
    "../app/account/actions.ts": ["loginAction", "registerAction", "logoutAction", "forgotPasswordAction", "resetPasswordAction", "resendActivationAction", "verifyEmailAction", "requestGuestClaimAction", "completeGuestClaimAction", "signOutForGuestClaimAction", "addWishlistItemToCart", "removeWishlistItem", "setWishlistItemAction", "requestDownloadAction", "requestCustomerDownloadAction", "updateProfileAction", "updatePreferencesAction"],
    "../app/cart/actions.ts": ["addToCart", "quickAddToCart", "removeFromCart", "updateCart", "applyCoupon", "removeCoupon", "clearCart"],
    "../app/checkout/actions.ts": ["quoteCheckout", "preparePendingOrder", "cleanupCompletedCheckoutCart", "getCompletedOrderDownloadUrl", "createRazorpayOrder", "verifyRazorpayPayment"],
    "../app/checkout/free/actions.ts": ["startFreeCheckout"],
  };
  for (const [path, names] of Object.entries(guarded)) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const name of names) {
      const start = source.indexOf(`export async function ${name}`);
      assert.notEqual(start, -1, `${name} exists`);
      const end = source.indexOf("\nexport ", start + 1);
      const body = source.slice(start, end === -1 ? undefined : end);
      assert.match(body, /await assertSameOriginRequest\(\)/, `${name} checks Origin before mutation`);
    }
  }
});

test("same-origin guard accepts only a present, valid Origin matching forwarded host and scheme", async () => {
  const guard = await loadOriginGuard();
  guard.setHeaders({ origin: "http://localhost:3000", host: "localhost:3000" });
  await assert.doesNotReject(guard.assertSameOriginRequest);
  for (const headers of [
    { origin: "https://attacker.example", host: "localhost:3000" },
    { host: "localhost:3000" },
    { origin: "not-a-url", host: "localhost:3000" },
    { origin: "http://localhost:3000", host: "localhost:3000", "x-forwarded-proto": "https" },
  ]) {
    guard.setHeaders(headers);
    await assert.rejects(guard.assertSameOriginRequest, /Cross-origin request rejected/);
  }
});
