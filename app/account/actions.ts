"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { assertSameOriginRequest, isSafeNextPath } from "@/lib/auth";
import { routes } from "@/lib/routes";
import {
  AuthError,
  getAuthService,
  getCartService,
  getCustomerService,
  getCustomerProfileService,
  getCustomerDownloadService,
  getDownloadService,
  getWishlistService,
  toAuthError,
} from "@/lib/services";
import type { ID, LicenseCode } from "@/lib/types";

/**
 * Auth + account actions. All session writes stay server-side: the
 * browser only ever sees the httpOnly session cookie the service sets.
 * Errors return the shopper to the form with `?error=` (+ `?code=` for
 * the cases that need a follow-up link, e.g. legacy migration).
 */

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function safeNext(raw: string): string {
  return isSafeNextPath(raw) ? raw : routes.account();
}

function authError(
  base: string,
  error: unknown,
  fallback: string,
  extra = "",
): never {
  const authError = toAuthError(error, fallback);
  redirect(
    `${base}?error=${encodeURIComponent(authError.message)}&code=${authError.code}${extra}`,
  );
}

function logAuthActionFailure(action: string, error: unknown): void {
  const candidate = typeof error === "object" && error !== null
    ? error as { name?: unknown; code?: unknown; status?: unknown }
    : null;
  const code = typeof candidate?.code === "string" && /^[a-z0-9_-]{1,64}$/i.test(candidate.code)
    ? candidate.code
    : undefined;
  const status = typeof candidate?.status === "number" && Number.isInteger(candidate.status)
    ? candidate.status
    : undefined;
  console.error(`[auth-action] request failed ${JSON.stringify({
    action,
    errorName: typeof candidate?.name === "string" ? candidate.name.slice(0, 80) : typeof error,
    ...(code ? { code } : {}),
    ...(status ? { status } : {}),
  })}`);
}

export async function loginAction(formData: FormData): Promise<void> {
  await assertSameOriginRequest();
  const next = safeNext(field(formData, "next"));
  const email = field(formData, "email");
  const preserve = `&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;
  try {
    await getAuthService().login({
      email,
      password: String(formData.get("password") ?? ""),
      remember: formData.get("remember") === "on",
    });
  } catch (error) {
    logAuthActionFailure("login", error);
    authError(
      routes.login(),
      error,
      "The email or password is incorrect.",
      preserve,
    );
  }
  revalidatePath(routes.home());
  revalidatePath(routes.account());
  redirect(next);
}

export async function registerAction(formData: FormData): Promise<void> {
  await assertSameOriginRequest();
  const next = safeNext(field(formData, "next"));
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirmPassword") ?? "")) {
    redirect(
      `${routes.register()}?error=${encodeURIComponent("Those passwords do not match.")}&code=password-mismatch&email=${encodeURIComponent(field(formData, "email"))}&name=${encodeURIComponent(field(formData, "name"))}&next=${encodeURIComponent(next)}`,
    );
  }
  const preserve = `&email=${encodeURIComponent(field(formData, "email"))}&name=${encodeURIComponent(field(formData, "name"))}&next=${encodeURIComponent(next)}`;
  let verificationRequired = false;
  try {
    const result = await getAuthService().register({
      name: field(formData, "name"),
      email: field(formData, "email"),
      password,
    });
    verificationRequired = result.verificationRequired;
  } catch (error) {
    logAuthActionFailure("register", error);
    authError(routes.register(), error, "Could not create your account. Please try again.", preserve);
  }
  if (verificationRequired) redirect(`${routes.register()}?sent=1`);
  revalidatePath(routes.home());
  revalidatePath(routes.account());
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  await assertSameOriginRequest();
  await getAuthService().logout();
  revalidatePath(routes.home());
  revalidatePath(routes.account());
  redirect(routes.home());
}

export async function forgotPasswordAction(formData: FormData): Promise<void> {
  await assertSameOriginRequest();
  try {
    await getAuthService().forgotPassword(field(formData, "email"));
  } catch (error) {
    authError(
      routes.forgotPassword(),
      error,
      "Could not send that email. Please try again.",
    );
  }
  redirect(`${routes.forgotPassword()}?sent=1`);
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  await assertSameOriginRequest();
  const token = field(formData, "token");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirmPassword") ?? "")) {
    redirect(
      `${routes.resetPassword()}?error=${encodeURIComponent("Those passwords do not match. Reopen your reset email to try again.")}`,
    );
  }
  try {
    await getAuthService().resetPassword({ token, password });
  } catch (error) {
    if (error instanceof AuthError && (error.code === "expired-token" || error.code === "invalid-token")) {
      redirect(
        `${routes.resetPassword()}?error=${encodeURIComponent(error.message)}&code=expired-token`,
      );
    }
    authError(
      routes.resetPassword(),
      error,
      "Could not reset your password. Request a fresh link.",
    );
  }
  redirect(`${routes.login()}?reset=success`);
}

export async function resendActivationAction(formData: FormData): Promise<void> {
  await assertSameOriginRequest();
  const email = field(formData, "email");
  try {
    await getAuthService().resendActivation(email);
  } catch {
    redirect(
      `${routes.login()}?error=${encodeURIComponent("Could not resend that email. Please try again.")}`,
    );
  }
  redirect(`${routes.verifyEmail()}?resent=1`);
}

export async function verifyEmailAction(formData: FormData): Promise<void> {
  await assertSameOriginRequest();
  let currentUserMatches = false;
  try {
    const result = await getAuthService().verifyEmail(field(formData, "token"));
    currentUserMatches = result.currentUserMatches;
  } catch (error) {
    const message = error instanceof AuthError
      ? error.message
      : "This verification link is invalid or has expired. Request a fresh link.";
    redirect(`${routes.verifyEmail()}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(routes.account());
  redirect(currentUserMatches ? routes.account() : `${routes.verifyEmail()}?verified=1&login=required`);
}

export async function requestGuestClaimAction(formData: FormData): Promise<void> {
  await assertSameOriginRequest();
  try {
    await getAuthService().requestGuestClaim(field(formData, "email"));
  } catch {
    redirect(
      `${routes.claimAccount()}?error=${encodeURIComponent("We could not process that request. Please try again shortly.")}`,
    );
  }
  redirect(`${routes.claimAccount()}?sent=1`);
}

export async function completeGuestClaimAction(formData: FormData): Promise<void> {
  await assertSameOriginRequest();
  try {
    await getAuthService().completeGuestClaim({
      token: field(formData, "token") || undefined,
      firstName: field(formData, "firstName"),
      lastName: field(formData, "lastName"),
      password: String(formData.get("password") ?? ""),
    });
  } catch (error) {
    if (error instanceof AuthError && error.code === "claim-login-required") {
      redirect(routes.login(routes.claimVerify()));
    }
    const message = error instanceof AuthError
      ? error.message
      : "We could not verify this link. Request a new one and try again.";
    redirect(`${routes.claimVerify()}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(routes.account());
  revalidatePath(routes.accountOrders());
  revalidatePath(routes.accountDownloads());
  redirect(`${routes.accountDownloads()}?recovered=1`);
}

export async function signOutForGuestClaimAction(): Promise<void> {
  await assertSameOriginRequest();
  await getAuthService().logout();
  redirect(routes.login(routes.claimVerify()));
}

/* ------------------------- Wishlist actions ------------------------- */

export async function addWishlistItemToCart(
  formData: FormData,
): Promise<void> {
  const productId = field(formData, "productId");
  const license = field(formData, "license") as LicenseCode;
  try {
    await getCartService().addItem(productId, license);
  } catch {
    redirect(
      `${routes.accountWishlist()}?error=${encodeURIComponent("Could not add that item to your cart.")}`,
    );
  }
  revalidatePath(routes.cart());
  revalidatePath(routes.accountWishlist());
  redirect(`${routes.accountWishlist()}?added=1`);
}

export async function removeWishlistItem(formData: FormData): Promise<void> {
  await assertSameOriginRequest();
  const productId = field(formData, "productId");
  try {
    await getWishlistService().removeItem(productId);
  } catch {
    redirect(`${routes.accountWishlist()}?error=${encodeURIComponent("Could not remove that saved item. Please try again.")}`);
  }
  revalidatePath(routes.home());
  revalidatePath(routes.accountWishlist());
  redirect(routes.accountWishlist());
}

export async function setWishlistItemAction(
  productId: ID,
  saved: boolean,
): Promise<{ saved: boolean; count: number } | { saved: boolean; count: number; error: string; requiresAuth?: boolean }> {
  await assertSameOriginRequest();
  if (typeof productId !== "string" || productId.length < 1 || productId.length > 200) {
    return { saved: false, count: 0, error: "Could not update your wishlist." };
  }

  try {
    const service = getWishlistService();
    const current = await service.getWishlist();
    const isSaved = current.items.some((item) => item.productId === productId);
    const updated = saved === isSaved
      ? current
      : saved
        ? await service.addItem(productId)
        : await service.removeItem(productId);
    revalidatePath(routes.accountWishlist());
    revalidatePath(routes.home());
    return {
      saved: updated.items.some((item) => item.productId === productId),
      count: updated.items.length,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { saved: false, count: 0, error: "Sign in to save products to your wishlist.", requiresAuth: true };
    }
    return { saved: false, count: 0, error: "Could not update your wishlist. Please try again." };
  }
}

/* ------------------------- Download actions ------------------------- */

export async function requestDownloadAction(
  productId: ID,
  orderId: ID,
): Promise<{ url: string } | { error: string }> {
  const download = await getDownloadService().requestDownloadUrl(
    productId,
    orderId,
  );
  if (!download) {
    return { error: "That file is no longer available for this order." };
  }
  return { url: download.url };
}

export async function requestCustomerDownloadAction(
  orderItemId: string,
  fileKey: string,
): Promise<{ url: string } | { error: string }> {
  try {
    const download = await getCustomerDownloadService().requestFileUrl(orderItemId, fileKey);
    return { url: download.url };
  } catch (error) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0)) {
      return { error: "EDD download access is no longer available or may have expired." };
    }
    return { error: "Your download could not be prepared. Please try again shortly." };
  }
}

/* ------------------------- Settings actions ------------------------- */

export async function updateProfileAction(formData: FormData): Promise<void> {
  await assertSameOriginRequest();
  if (process.env.CH_AUTH_MODE === "wordpress") {
    try {
      await getCustomerProfileService().update({
        firstName: field(formData, "firstName"),
        lastName: field(formData, "lastName"),
      });
    } catch (error) {
      authError(routes.accountProfile(), error, "Could not save your profile. Please try again.");
    }
    revalidatePath(routes.accountProfile());
    revalidatePath(routes.accountSettings());
    revalidatePath(routes.account());
    redirect(`${routes.accountProfile()}?saved=1`);
  }
  try {
    await getCustomerService().updateProfile({
      firstName: field(formData, "firstName"),
      lastName: field(formData, "lastName"),
    });
  } catch (error) {
    const errorRoute = field(formData, "returnTo") === "profile"
      ? routes.accountProfile()
      : routes.accountSettings();
    authError(
      errorRoute,
      error,
      "Could not save your profile. Please try again.",
    );
  }
  revalidatePath(routes.account());
  revalidatePath(routes.accountProfile());
  redirect(field(formData, "returnTo") === "profile"
    ? `${routes.accountProfile()}?saved=1`
    : `${routes.accountSettings()}?saved=profile`);
}

export async function updatePreferencesAction(
  formData: FormData,
): Promise<void> {
  await getCustomerService().updateNotificationPreferences({
    orderUpdates: formData.get("orderUpdates") === "on",
    newProducts: formData.get("newProducts") === "on",
    offers: formData.get("offers") === "on",
  });
  revalidatePath(routes.accountSettings());
  redirect(`${routes.accountSettings()}?saved=notifications`);
}
