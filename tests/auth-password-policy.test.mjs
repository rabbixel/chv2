import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePassword, passwordErrorMessage } from "../lib/auth/passwordPolicy.mjs";
import { AuthServiceUnavailableError, isTransientAuthFailure } from "../lib/auth/availability.mjs";

test("password policy matches the backend 12-to-128 byte and three-of-four rule", () => {
  assert.equal(passwordErrorMessage("short"), "Password must contain at least 12 characters.");
  assert.equal(evaluatePassword("TwelveChars1A").valid, true);
  assert.equal(evaluatePassword("TwelveChars!A").valid, true);
  assert.equal(evaluatePassword("onlylowercase123").valid, false);
  assert.match(passwordErrorMessage("onlylowercase123"), /more character type/);
  assert.equal(evaluatePassword(`A1!${"a".repeat(125)}`).valid, true);
  assert.equal(evaluatePassword(`A1!${"a".repeat(126)}`).valid, false);
});

test("temporary authentication failures are distinguished from invalid sessions", () => {
  assert.equal(isTransientAuthFailure({ status: 503, code: "auth_bridge_unavailable" }), true);
  assert.equal(isTransientAuthFailure({ status: 429 }), true);
  assert.equal(isTransientAuthFailure({ status: 401, code: "invalid_session" }), false);
  assert.equal(isTransientAuthFailure(new TypeError("network error")), true);
  assert.equal(isTransientAuthFailure(new Error("programming error")), false);
  assert.match(new AuthServiceUnavailableError().message, /try again shortly/i);
});
