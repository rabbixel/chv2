import { redirect } from "next/navigation";
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

/**
 * Open-redirect guard for `?next=`: same-origin app paths only.
 * Shared by the guard and the login/register actions.
 */
export function isSafeNextPath(next: string): boolean {
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("://");
}
