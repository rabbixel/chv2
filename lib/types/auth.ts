import type { Customer } from "./customer";

/**
 * The signed-in shopper. Creative Hatti has one customer record per
 * account; the auth service returns the same `Customer` the rest of the
 * storefront uses — no parallel user model.
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
  | "weak-password"
  | "validation";
