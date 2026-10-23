import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function moduleUrl(path, replacements = []) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}

const apiClient = await moduleUrl("../lib/api/client.ts");
process.env.CH_API_URL = "http://checkout.test/wp-json/ch/v1";
const authStub = `data:text/javascript,export const getWordPressOptionalSessionBridgeHeaders=async()=>({"X-CH-Auth-Bridge":"trusted",...(globalThis.__checkoutAuthToken?{Authorization:"Bearer "+globalThis.__checkoutAuthToken}:{})});export const getWordPressBridgeHeaders=()=>({"X-CH-Auth-Bridge":"trusted"});`;
const guestSafeUrl = await moduleUrl("../lib/services/guestSafeRequest.ts", [
  ['import "server-only";', ""],
  ['"@/lib/api/client"', JSON.stringify(apiClient)],
  ['"./authService"', JSON.stringify(authStub)],
]);
const guestSafe = await import(guestSafeUrl);
const endpointStub = `data:text/javascript,export const apiEndpoints={checkoutQuote:"/checkout/quote",checkoutPrepare:"/checkout/prepare"};`;
const modeStub = `data:text/javascript,export const isLiveApiEnabled=()=>true;`;
const checkoutServiceUrl = await moduleUrl("../lib/services/checkoutService.ts", [
  ['import "server-only";', ""],
  ['"@/lib/api/endpoints"', JSON.stringify(endpointStub)],
  ['"./guestSafeRequest"', JSON.stringify(guestSafeUrl)],
  ['"./apiMode"', JSON.stringify(modeStub)],
]);
const checkoutService = await import(checkoutServiceUrl);

test("expired optional session retries checkout as guest only after invalid_session", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.__checkoutAuthToken = "stale";
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    if (calls === 1) {
      assert.equal(options.headers.Authorization, "Bearer stale");
      return new Response(JSON.stringify({ success: false, error: { code: "invalid_session", message: "Authentication required." } }), { status: 401 });
    }
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers["X-CH-Auth-Bridge"], "trusted");
    assert.equal(JSON.parse(options.body).email, "member@example.test");
    return new Response(JSON.stringify({ success: true, data: { id: 22, status: "pending" } }), { status: 201 });
  };
  try {
    const result = await guestSafe.guestSafeApiFetch("/checkout/prepare", { method: "POST", body: { email: "member@example.test" } });
    assert.equal(result.data.id, 22);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; delete globalThis.__checkoutAuthToken; }
});

test("checkout preparation service retries stale-session guest order preparation", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.__checkoutAuthToken = "stale";
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    if (calls === 1) return new Response(JSON.stringify({ success: false, error: { code: "invalid_session", message: "Authentication required." } }), { status: 401 });
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers["Idempotency-Key"], "12345678-abcd-1234-abcd-123456789012");
    const body = JSON.parse(options.body);
    assert.equal(body.billing.email, "buyer@example.test");
    return new Response(JSON.stringify({ success: true, data: { id: 22, number: "T22", status: "pending", total: { amount: 12.5, currency: "INR" } } }), { status: 201 });
  };
  try {
    const prepared = await checkoutService.getCheckoutService().prepare({
      cart: { items: [{ productId: "8", priceId: null, quantity: 1, available: true }] },
      billing: { fullName: "Buyer", email: "buyer@example.test", phone: "+919876543210", country: "IN", region: "" },
      idempotencyKey: "12345678-abcd-1234-abcd-123456789012",
    });
    assert.equal(prepared.status, "pending");
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; delete globalThis.__checkoutAuthToken; }
});

test("valid authenticated request is never downgraded", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.__checkoutAuthToken = "valid";
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    assert.equal(options.headers.Authorization, "Bearer valid");
    return new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200 });
  };
  try {
    assert.deepEqual(await guestSafe.guestSafeApiFetch("/checkout/prepare", { method: "POST", body: {} }), { success: true, data: { ok: true } });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; delete globalThis.__checkoutAuthToken; }
});

test("fresh guest request carries only the trusted bridge and is not retried", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers["X-CH-Auth-Bridge"], "trusted");
    return new Response(JSON.stringify({ success: true, data: { id: 23 } }), { status: 201 });
  };
  try {
    const result = await guestSafe.guestSafeApiFetch("/checkout/prepare", { method: "POST", body: {} });
    assert.equal(result.data.id, 23);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("other authorization or server failures are never retried as guest", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.__checkoutAuthToken = "stale";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ success: false, error: { code: "auth_bridge_unavailable", message: "Unavailable." } }), { status: 503 });
  };
  try {
    await assert.rejects(guestSafe.guestSafeApiFetch("/checkout/prepare", { method: "POST", body: {} }), (error) => error.status === 503 && error.code === "auth_bridge_unavailable");
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; delete globalThis.__checkoutAuthToken; }
});
