import "server-only";

import { cookies } from "next/headers";
import { AuthServiceUnavailableError, isTransientAuthFailure } from "@/lib/auth/availability.mjs";
import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import {
  AUTH_SESSION_COOKIE,
  AUTH_STATE_COOKIE,
  CLAIM_SESSION_COOKIE,
} from "@/lib/constants";
import type {
  AuthErrorCode,
  AuthUser,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from "@/lib/types";

export interface AuthService {
  login(input: LoginInput): Promise<AuthUser>;
  register(input: RegisterInput): Promise<{ verificationRequired: boolean }>;
  verifyEmail(token: string): Promise<{ user: AuthUser; currentUserMatches: boolean }>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<AuthUser | null>;
  /** Internal identity context; the EDD customer id must stay server-side. */
  getCurrentIdentity(): Promise<AuthIdentity | null>;
  updateProfile(input: UpdateProfileInput): Promise<AuthUser>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(input: ResetPasswordInput): Promise<void>;
  /** Re-send the activation email for accounts pending activation. */
  resendActivation(email: string): Promise<void>;
  requestGuestClaim(email: string): Promise<void>;
  completeGuestClaim(input: GuestClaimInput): Promise<AuthUser>;
  hasPendingGuestClaim(): Promise<boolean>;
}

export interface GuestClaimInput {
  token?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
}

export interface AuthIdentity {
  user: AuthUser;
  eddCustomerId: number | null;
  emailMismatch: boolean;
}

interface AuthApiEnvelope<T> {
  success: boolean;
  data: T;
}

interface WordPressProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  created_at: string;
}

interface WordPressLoginResponse {
  session: { user_id: number; token: string; expires_at: string };
  user: WordPressProfile;
}

interface WordPressIdentityResponse {
  user: WordPressProfile;
  edd_customer_id: number | null;
  identity_email_mismatch: boolean;
}

interface WordPressClaimResponse {
  linked: boolean;
  session: WordPressLoginResponse["session"] | null;
  user: WordPressProfile;
}

interface WordPressVerificationResponse {
  session: WordPressLoginResponse["session"] | null;
  current_user_matches: boolean;
  user: WordPressProfile;
}

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

/* ------------------------------ Mock ------------------------------ */

/**
 * Mock session store (single process; the backend owns sessions for real).
 * The mock deliberately models the states the real migration must handle:
 * active accounts, pending activation, and classic-store (WordPress/EDD)
 * emails whose passwords were NOT migrated and must reset to sign in.
 */
interface MockSession {
  userId: string;
  expiresAt: number;
}

const sessionStore = new Map<string, MockSession>();
const userStore = new Map<string, AuthUser>();
/** Profile edits layered over seed users (keyed by user id). */
const profileOverrides = new Map<string, AuthUser>();
let sessionSeq = 0;

const DEMO_USER: AuthUser = {
  id: "customer-demo",
  email: "demo@creativehatti.com",
  firstName: "Anaya",
  lastName: "Sharma",
  createdAt: "2026-01-15T10:00:00.000Z",
};
const DEMO_PASSWORD = "demo1234";

const PENDING_USER: AuthUser = {
  id: "customer-pending",
  email: "pending@creativehatti.com",
  firstName: "Pending",
  lastName: "Customer",
  createdAt: "2026-09-20T10:00:00.000Z",
};

/** Classic-store emails known to the mock; the backend owns the real list. */
const LEGACY_EMAILS = new Set(["legacy@creativehatti.com"]);

/**
 * Deterministic mock reset token (scaffold only). The backend issues
 * single-use expiring tokens; the UI treats any token as opaque.
 */
const MOCK_RESET_TOKEN = "mock-reset-token";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD_LENGTH = 12;

function sessionCookieOptions(remember: boolean) {
  return {
    path: "/",
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
}

function claimCookieOptions() {
  return {
    path: "/claim-account",
    maxAge: 60 * 30,
    sameSite: "strict" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
}

async function storePendingGuestClaim(token: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(token)) return;
  (await cookies()).set(CLAIM_SESSION_COOKIE, token, claimCookieOptions());
}

async function readPendingGuestClaim(): Promise<string | null> {
  const value = (await cookies()).get(CLAIM_SESSION_COOKIE)?.value ?? "";
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}

async function clearPendingGuestClaim(): Promise<void> {
  (await cookies()).delete(CLAIM_SESSION_COOKIE);
}

function wordPressAuthEnabled(): boolean {
  return process.env.CH_AUTH_MODE === "wordpress";
}

function bridgeHeaders(authorization?: string): Record<string, string> {
  const secret = process.env.CH_AUTH_BRIDGE_SECRET;
  if (!secret || secret.length < 32) {
    throw new AuthServiceUnavailableError();
  }
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.CH_API_URL?.startsWith("https://")
  ) {
    throw new AuthServiceUnavailableError();
  }

  return {
    "X-CH-Auth-Bridge": secret,
    ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
  };
}

function claimFrontendOrigin(): string {
  const configured = process.env.CH_AUTH_FRONTEND_URL;
  if (!configured) {
    throw new AuthError("validation", "Customer account claiming is not configured.");
  }
  try {
    const origin = new URL(configured);
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      (process.env.NODE_ENV === "production" && origin.protocol !== "https:")
    ) {
      throw new Error("invalid frontend origin");
    }
    return origin.origin;
  } catch {
    throw new AuthError("validation", "Customer account claiming is not configured.");
  }
}

function fromWordPressProfile(profile: WordPressProfile): AuthUser {
  const createdAt = new Date(profile.created_at);
  return {
    id: String(profile.id),
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    phone: profile.phone,
    createdAt: Number.isNaN(createdAt.getTime())
      ? new Date(0).toISOString()
      : createdAt.toISOString(),
  };
}

async function readWordPressSession(): Promise<string | null> {
  const raw = (await cookies()).get(AUTH_SESSION_COOKIE)?.value ?? "";
  const match = raw.match(/^([1-9][0-9]*)\.([A-Za-z0-9]{43})$/);
  return match ? raw : null;
}

/** Server-only headers for authenticated calls from backend-facing services. */
export async function getWordPressSessionBridgeHeaders(): Promise<Record<string, string>> {
  const session = await readWordPressSession();
  if (!session) {
    throw new ApiError(401, "invalid_session", "Authentication required.");
  }
  return bridgeHeaders(session);
}

/** Trusted server bridge for guest-safe cart validation, with a session when present. */
export async function getWordPressOptionalSessionBridgeHeaders(): Promise<Record<string, string>> {
  return bridgeHeaders(await readWordPressSession() ?? undefined);
}

/** Server-only bridge headers for guest-safe endpoints that do not need user identity. */
export function getWordPressBridgeHeaders(): Record<string, string> {
  return bridgeHeaders();
}

async function storeWordPressSession(
  session: WordPressLoginResponse["session"],
  remember: boolean,
): Promise<void> {
  const jar = await cookies();
  const options = sessionCookieOptions(remember);
  jar.set(
    AUTH_SESSION_COOKIE,
    `${session.user_id}.${session.token}`,
    {
      ...options,
      ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
    },
  );
  jar.set(AUTH_STATE_COOKIE, "1", { ...options, httpOnly: false });
}

async function createSession(userId: string, remember: boolean): Promise<void> {
  sessionSeq += 1;
  const sessionId = `sess-${Date.now().toString(36)}-${sessionSeq}`;
  const ttl = remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12;
  sessionStore.set(sessionId, { userId, expiresAt: Date.now() + ttl });
  const jar = await cookies();
  jar.set(AUTH_SESSION_COOKIE, sessionId, sessionCookieOptions(remember));
  jar.set(AUTH_STATE_COOKIE, "1", { ...sessionCookieOptions(remember), httpOnly: false });
}

async function clearSession(): Promise<void> {
  const jar = await cookies();
  const sessionId = jar.get(AUTH_SESSION_COOKIE)?.value;
  if (sessionId) sessionStore.delete(sessionId);
  jar.delete(AUTH_SESSION_COOKIE);
  jar.delete(AUTH_STATE_COOKIE);
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function isStrongPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= 128 &&
    [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length >= 3;
}

class MockAuthService implements AuthService {
  async login(input: LoginInput): Promise<AuthUser> {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email) || !input.password) {
      throw new AuthError(
        "invalid-credentials",
        "That email and password combination did not work.",
      );
    }
    if (LEGACY_EMAILS.has(email)) {
      // Classic-store passwords were never migrated: the only safe path
      // is a password reset, never a password guess.
      throw new AuthError(
        "legacy-account",
        "This email belongs to our classic store. Reset your password to activate your new account.",
      );
    }
    if (email === PENDING_USER.email) {
      if (input.password !== DEMO_PASSWORD) {
        throw new AuthError(
          "invalid-credentials",
          "That email and password combination did not work.",
        );
      }
      throw new AuthError(
        "not-activated",
        "Your account is waiting for email activation.",
      );
    }
    const registered = userStore.get(email);
    const user = email === DEMO_USER.email ? DEMO_USER : registered;
    const password = email === DEMO_USER.email ? DEMO_PASSWORD : registered
      ? MockAuthService.passwordFor(email)
      : null;
    if (!user || input.password !== password) {
      throw new AuthError(
        "invalid-credentials",
        "That email and password combination did not work.",
      );
    }
    await createSession(user.id, input.remember ?? false);
    return user;
  }

  async register(input: RegisterInput): Promise<{ verificationRequired: boolean }> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 2) {
      throw new AuthError("validation", "Please enter your name.");
    }
    if (!EMAIL_PATTERN.test(email)) {
      throw new AuthError(
        "validation",
        "That email address does not look right.",
      );
    }
    if (!isStrongPassword(input.password)) {
      throw new AuthError(
        "weak-password",
        "Use at least 12 characters with a mix of letter cases, numbers and symbols.",
      );
    }
    if (
      email === DEMO_USER.email ||
      email === PENDING_USER.email ||
      LEGACY_EMAILS.has(email) ||
      userStore.has(email)
    ) {
      return { verificationRequired: true };
    }
    const { firstName, lastName } = splitName(name);
    const user: AuthUser = {
      id: `customer-${Date.now().toString(36)}`,
      email,
      firstName,
      lastName,
      createdAt: new Date().toISOString(),
    };
    userStore.set(email, user);
    MockAuthService.rememberPassword(email, input.password);
    await createSession(user.id, false);
    return { verificationRequired: false };
  }

  async verifyEmail(token: string): Promise<{ user: AuthUser; currentUserMatches: boolean }> {
    void token;
    throw new AuthError("invalid-token", "This verification link is invalid or has expired.");
  }

  async logout(): Promise<void> {
    await clearSession();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const sessionId = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;
    if (!sessionId) return null;
    const session = sessionStore.get(sessionId);
    if (!session || session.expiresAt < Date.now()) {
      if (session) sessionStore.delete(sessionId);
      return null;
    }
    if (session.userId === DEMO_USER.id) {
      return profileOverrides.get(DEMO_USER.id) ?? DEMO_USER;
    }
    for (const user of userStore.values()) {
      if (user.id === session.userId) {
        return profileOverrides.get(user.id) ?? user;
      }
    }
    return null;
  }

  async getCurrentIdentity(): Promise<AuthIdentity | null> {
    const user = await this.getCurrentUser();
    return user ? { user, eddCustomerId: null, emailMismatch: false } : null;
  }

  async updateProfile(input: UpdateProfileInput): Promise<AuthUser> {
    const current = await this.getCurrentUser();
    if (!current) throw new AuthError("validation", "You must be logged in.");
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    if (!firstName) {
      throw new AuthError("validation", "Please enter your first name.");
    }
    const updated: AuthUser = { ...current, firstName, lastName };
    profileOverrides.set(current.id, updated);
    if (userStore.get(current.email)?.id === current.id) {
      userStore.set(current.email, updated);
    }
    return updated;
  }

  async forgotPassword(email: string): Promise<void> {
    if (!EMAIL_PATTERN.test(email.trim())) {
      throw new AuthError(
        "validation",
        "That email address does not look right.",
      );
    }
    // Always succeeds: the UI never reveals whether an email is registered.
    // In mock mode the reset link carries MOCK_RESET_TOKEN (see above).
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    if (!input.token) {
      throw new AuthError(
        "invalid-token",
        "This reset link is missing its token.",
      );
    }
    if (input.token === "expired") {
      throw new AuthError(
        "expired-token",
        "This reset link has expired. Request a fresh one.",
      );
    }
    if (input.token !== MOCK_RESET_TOKEN) {
      throw new AuthError(
        "invalid-token",
        "This reset link is not valid. Request a fresh one.",
      );
    }
    if (!isStrongPassword(input.password)) {
      throw new AuthError(
        "weak-password",
        "Use at least 12 characters with a mix of letter cases, numbers and symbols.",
      );
    }
  }

  async resendActivation(email: string): Promise<void> {
    if (!EMAIL_PATTERN.test(email.trim())) {
      throw new AuthError(
        "validation",
        "That email address does not look right.",
      );
    }
    // Always succeeds (no enumeration); the backend sends when pending.
  }

  async requestGuestClaim(email: string): Promise<void> {
    void email;
    throw new AuthError("validation", "Customer account claiming is not available in mock mode.");
  }

  async completeGuestClaim(input: GuestClaimInput): Promise<AuthUser> {
    void input;
    throw new AuthError("validation", "Customer account claiming is not available in mock mode.");
  }

  async hasPendingGuestClaim(): Promise<boolean> {
    return false;
  }

  /* Mock-only password vault (plaintext scaffold — the backend hashes). */
  private static passwords = new Map<string, string>();

  private static passwordFor(email: string): string | null {
    return MockAuthService.passwords.get(email) ?? null;
  }

  private static rememberPassword(email: string, password: string): void {
    MockAuthService.passwords.set(email, password);
  }
}

/* ------------------------------ API ------------------------------ */

class ApiAuthService implements AuthService {
  async login(input: LoginInput): Promise<AuthUser> {
    const result = await apiFetch<AuthApiEnvelope<WordPressLoginResponse>>(
      apiEndpoints.auth.login,
      {
        method: "POST",
        body: input,
        headers: bridgeHeaders(),
        cache: "no-store",
        redirect: "error",
        timeoutMs: 10_000,
      },
    );
    const user = fromWordPressProfile(result.data.user);
    await storeWordPressSession(result.data.session, input.remember ?? false);
    return user;
  }

  async register(input: RegisterInput): Promise<{ verificationRequired: boolean }> {
    await apiFetch<AuthApiEnvelope<{ message: string }>>(apiEndpoints.auth.register, {
      method: "POST", body: { ...input, frontend_origin: claimFrontendOrigin() }, headers: bridgeHeaders(), cache: "no-store", redirect: "error", timeoutMs: 10_000,
    });
    return { verificationRequired: true };
  }

  async verifyEmail(token: string): Promise<{ user: AuthUser; currentUserMatches: boolean }> {
    const result = await apiFetch<AuthApiEnvelope<WordPressVerificationResponse>>(apiEndpoints.auth.verifyEmail, {
      method: "POST", body: { token }, headers: bridgeHeaders(await readWordPressSession() ?? undefined), cache: "no-store", redirect: "error", timeoutMs: 10_000,
    });
    if (result.data.session) await storeWordPressSession(result.data.session, false);
    return { user: fromWordPressProfile(result.data.user), currentUserMatches: result.data.current_user_matches };
  }

  async logout(): Promise<void> {
    const session = await readWordPressSession();
    if (session) {
      try {
        await apiFetch<AuthApiEnvelope<{ logged_out: boolean }>>(
          apiEndpoints.auth.logout,
          {
            method: "POST",
            headers: bridgeHeaders(session),
            cache: "no-store",
            redirect: "error",
            timeoutMs: 10_000,
          },
        );
      } catch (error) {
        // A server-revoked or expired token is already unusable; clear the
        // local cookie. Keep it if the backend is temporarily unreachable.
        if (!(error instanceof ApiError && error.status === 401)) throw error;
      }
    }
    await clearSession();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const identity = await this.getCurrentIdentity();
    return identity?.user ?? null;
  }

  async getCurrentIdentity(): Promise<AuthIdentity | null> {
    const session = await readWordPressSession();
    if (!session) return null;

    try {
      const result = await apiFetch<AuthApiEnvelope<WordPressIdentityResponse>>(
        apiEndpoints.customer.me,
        {
          headers: bridgeHeaders(session),
          cache: "no-store",
          redirect: "error",
          timeoutMs: 10_000,
        },
      );
      return {
        user: fromWordPressProfile(result.data.user),
        eddCustomerId: result.data.edd_customer_id,
        emailMismatch: result.data.identity_email_mismatch,
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      if (error instanceof AuthServiceUnavailableError) {
        console.error(`[auth-identity] request failed ${JSON.stringify({
          endpoint: apiEndpoints.customer.me,
          errorName: error.name,
          code: error.code,
        })}`);
        throw error;
      }
      if (isTransientAuthFailure(error)) {
        const candidate = typeof error === "object" && error !== null
          ? error as { name?: unknown; code?: unknown; status?: unknown }
          : null;
        const code = typeof candidate?.code === "string" && /^[a-z0-9_-]{1,64}$/i.test(candidate.code)
          ? candidate.code
          : undefined;
        const status = typeof candidate?.status === "number" && Number.isInteger(candidate.status)
          ? candidate.status
          : undefined;
        console.error(`[auth-identity] request failed ${JSON.stringify({
          endpoint: apiEndpoints.customer.me,
          errorName: typeof candidate?.name === "string" ? candidate.name.slice(0, 80) : typeof error,
          ...(code ? { code } : {}),
          ...(status ? { status } : {}),
        })}`);
        throw new AuthServiceUnavailableError();
      }
      throw error;
    }
  }

  async updateProfile(): Promise<AuthUser> {
    throw new AuthError("validation", "Profile editing is not available yet.");
  }

  async forgotPassword(email: string): Promise<void> {
    await apiFetch<AuthApiEnvelope<{ message: string }>>(apiEndpoints.auth.forgotPassword, {
      method: "POST", body: { email, frontend_origin: claimFrontendOrigin() }, headers: bridgeHeaders(), cache: "no-store", redirect: "error", timeoutMs: 10_000,
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const result = await apiFetch<AuthApiEnvelope<{ password_reset: boolean }>>(apiEndpoints.auth.resetPassword, {
      method: "POST", body: input, headers: bridgeHeaders(), cache: "no-store", redirect: "error", timeoutMs: 10_000,
    });
    if (!result.data.password_reset) throw new AuthError("invalid-token", "This password reset link is invalid or has expired.");
  }

  async resendActivation(email: string): Promise<void> {
    await apiFetch<AuthApiEnvelope<{ message: string }>>(apiEndpoints.auth.resendActivation, {
      method: "POST", body: { email, frontend_origin: claimFrontendOrigin() }, headers: bridgeHeaders(), cache: "no-store", redirect: "error", timeoutMs: 10_000,
    });
  }

  async requestGuestClaim(email: string): Promise<void> {
    await apiFetch<AuthApiEnvelope<{ message: string }>>(
      apiEndpoints.customer.claimRequest,
      {
        method: "POST",
        body: { email, frontend_origin: claimFrontendOrigin() },
        headers: bridgeHeaders(),
        cache: "no-store",
        redirect: "error",
        timeoutMs: 10_000,
      },
    );
  }

  async completeGuestClaim(input: GuestClaimInput): Promise<AuthUser> {
    const token = input.token ?? (await readPendingGuestClaim());
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      throw new AuthError(
        "invalid-token",
        "This verification link is invalid or has expired. Request a new link and try again.",
      );
    }

    await storePendingGuestClaim(token);
    const session = await readWordPressSession();
    try {
      const result = await apiFetch<AuthApiEnvelope<WordPressClaimResponse>>(
        apiEndpoints.customer.claimComplete,
        {
          method: "POST",
          body: {
            token,
            first_name: input.firstName,
            last_name: input.lastName,
            password: input.password,
          },
          headers: bridgeHeaders(session ?? undefined),
          cache: "no-store",
          redirect: "error",
          timeoutMs: 10_000,
        },
      );
      if (result.data.session) {
        await storeWordPressSession(result.data.session, false);
      }
      await clearPendingGuestClaim();
      return fromWordPressProfile(result.data.user);
    } catch (error) {
      if (error instanceof ApiError && error.code === "claim_login_required") {
        await storePendingGuestClaim(token);
        throw new AuthError(
          "claim-login-required",
          "Sign in to the WordPress account that uses this verified email, then continue.",
        );
      }
      if (error instanceof ApiError && error.code === "claim_conflict") {
        await storePendingGuestClaim(token);
        throw new AuthError(
          "claim-account-conflict",
          "This purchase record could not be linked to the signed-in account. Sign in with the verified email or contact support.",
        );
      }
      if (error instanceof ApiError && error.code === "invalid_claim") {
        await clearPendingGuestClaim();
        throw new AuthError(
          "invalid-token",
          "This verification link is invalid or has expired. Request a new link and try again.",
        );
      }
      throw error;
    }
  }

  async hasPendingGuestClaim(): Promise<boolean> {
    return null !== (await readPendingGuestClaim());
  }
}

/* ---------------------------- Factory ---------------------------- */

let cached: AuthService | null = null;

export function getAuthService(): AuthService {
  cached ??=
    wordPressAuthEnabled()
      ? new ApiAuthService()
      : new MockAuthService();
  return cached;
}

export function isWordPressAuthEnabled(): boolean {
  return wordPressAuthEnabled();
}

/** Re-throw backend failures as `AuthError` where the code survives. */
export function toAuthError(error: unknown, fallback: string): AuthError {
  if (error instanceof AuthError) return error;
  if (error instanceof ApiError && typeof error.status === "number") {
    if (error.code === "weak_password") {
      return new AuthError("weak-password", error.message);
    }
    if (error.code === "invalid_name") {
      return new AuthError("invalid-name", error.message);
    }
    if (error.code === "invalid_email") {
      return new AuthError("invalid-email", error.message);
    }
    if (error.code === "expired_token") {
      return new AuthError("expired-token", error.message);
    }
    if (error.code === "invalid_verification") {
      return new AuthError("invalid-token", error.message);
    }
    if (error.status === 401 || error.status === 403) {
      return new AuthError("invalid-credentials", fallback);
    }
    if (error.status === 409) {
      return new AuthError("email-taken", fallback);
    }
    if (error.status === 410) {
      return new AuthError("expired-token", fallback);
    }
  }
  return new AuthError("validation", fallback);
}
