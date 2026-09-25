import { cookies } from "next/headers";
import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { AUTH_SESSION_COOKIE } from "@/lib/constants";
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
  register(input: RegisterInput): Promise<AuthUser>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<AuthUser | null>;
  updateProfile(input: UpdateProfileInput): Promise<AuthUser>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(input: ResetPasswordInput): Promise<void>;
  /** Re-send the activation email for accounts pending activation. */
  resendActivation(email: string): Promise<void>;
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
const MIN_PASSWORD_LENGTH = 8;

function sessionCookieOptions(remember: boolean) {
  return {
    path: "/",
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
}

async function createSession(userId: string, remember: boolean): Promise<void> {
  sessionSeq += 1;
  const sessionId = `sess-${Date.now().toString(36)}-${sessionSeq}`;
  const ttl = remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12;
  sessionStore.set(sessionId, { userId, expiresAt: Date.now() + ttl });
  (await cookies()).set(
    AUTH_SESSION_COOKIE,
    sessionId,
    sessionCookieOptions(remember),
  );
}

async function clearSession(): Promise<void> {
  const jar = await cookies();
  const sessionId = jar.get(AUTH_SESSION_COOKIE)?.value;
  if (sessionId) sessionStore.delete(sessionId);
  jar.delete(AUTH_SESSION_COOKIE);
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
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

  async register(input: RegisterInput): Promise<AuthUser> {
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
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError(
        "weak-password",
        `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }
    if (
      email === DEMO_USER.email ||
      email === PENDING_USER.email ||
      LEGACY_EMAILS.has(email) ||
      userStore.has(email)
    ) {
      throw new AuthError(
        "email-taken",
        "An account with this email already exists. Try logging in instead.",
      );
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
    return user;
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
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError(
        "weak-password",
        `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`,
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
    return apiFetch<AuthUser>(apiEndpoints.auth.login, {
      method: "POST",
      body: input,
    });
  }

  async register(input: RegisterInput): Promise<AuthUser> {
    return apiFetch<AuthUser>(apiEndpoints.auth.register, {
      method: "POST",
      body: input,
    });
  }

  async logout(): Promise<void> {
    await apiFetch<void>(apiEndpoints.auth.logout, { method: "POST" });
  }

  getCurrentUser(): Promise<AuthUser | null> {
    return apiFetch<AuthUser | null>(apiEndpoints.customer.me);
  }

  updateProfile(input: UpdateProfileInput): Promise<AuthUser> {
    return apiFetch<AuthUser>(apiEndpoints.customer.me, {
      method: "PATCH",
      body: input,
    });
  }

  async forgotPassword(email: string): Promise<void> {
    await apiFetch<void>(apiEndpoints.auth.forgotPassword, {
      method: "POST",
      body: { email },
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    await apiFetch<void>(apiEndpoints.auth.resetPassword, {
      method: "POST",
      body: input,
    });
  }

  async resendActivation(email: string): Promise<void> {
    await apiFetch<void>(apiEndpoints.auth.resendActivation, {
      method: "POST",
      body: { email },
    });
  }
}

/* ---------------------------- Factory ---------------------------- */

let cached: AuthService | null = null;

export function getAuthService(): AuthService {
  cached ??=
    process.env.USE_MOCK_API === "false"
      ? new ApiAuthService()
      : new MockAuthService();
  return cached;
}

/** Re-throw backend failures as `AuthError` where the code survives. */
export function toAuthError(error: unknown, fallback: string): AuthError {
  if (error instanceof AuthError) return error;
  if (error instanceof ApiError && typeof error.status === "number") {
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
