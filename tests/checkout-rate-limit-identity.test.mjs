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
  return { proxy: mod.exports.proxy, get forwarded() { return forwarded; }, get cookie() { return cookie; } };
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
