import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { routes } from "@/lib/routes";
import { getAuthService } from "@/lib/services";
import type { AuthUser } from "@/lib/types";

/**
 * Protected-route abstraction (server-side). Call at the top of account
 * layouts/pages: returns the signed-in customer or redirects to login.
 * This redirect is the actual enforcement — nav links hiding is UX only
 * and never a substitute.
 */
export async function requireUser(next?: string): Promise<AuthUser> {
  const user = await getAuthService().getCurrentUser();
  if (!user) {
    const target = next && isSafeNextPath(next) ? next : routes.account();
    redirect(routes.login(target));
  }
  return user;
}

/** Current user without enforcing (header, personalization). */
export async function getSessionUser(): Promise<AuthUser | null> {
  return getAuthService().getCurrentUser();
}

/** Reject cross-origin form submissions before they reach auth mutations. */
export async function assertSameOriginRequest(): Promise<void> {
  const requestHeaders = await headers();
  const originValue = requestHeaders.get("origin");
  const host = (
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? ""
  )
    .split(",")[0]
    .trim();
  const protocol = (
    requestHeaders.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http")
  )
    .split(",")[0]
    .trim()
    .replace(/:$/, "");

  if (!originValue || !host || !["http", "https"].includes(protocol)) {
    throw new Error("Cross-origin request rejected.");
  }

  try {
    const origin = new URL(originValue);
    if (origin.origin !== `${protocol}://${host}`) {
      throw new Error("Cross-origin request rejected.");
    }
  } catch {
    throw new Error("Cross-origin request rejected.");
  }
}

/**
 * Open-redirect guard for `?next=`: same-origin app paths only.
 * Shared by the guard and the login/register actions.
 */
export function isSafeNextPath(next: string): boolean {
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("://");
}
