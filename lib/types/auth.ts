import type { Customer } from "./customer";

/**
 * Safe profile for a signed-in WordPress account. EDD customer linkage stays
 * in the server-only AuthIdentity context, not in this profile.
 */
export type AuthUser = Customer;

export interface LoginInput {
  email: string;
  password: string;
  /** Extend the session cookie (30 days) instead of a browser session. */
  remember?: boolean;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

/**
 * Machine-readable auth failures. The UI maps these to messages; the
 * codes are part of the service contract so the future backend can
 * return the same vocabulary (migration, activation, expiry).
 */
export type AuthErrorCode =
  | "invalid-credentials"
  | "email-taken"
  | "legacy-account"
  | "not-activated"
  | "invalid-token"
  | "expired-token"
  | "claim-login-required"
  | "claim-account-conflict"
  | "weak-password"
  | "validation";
