"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertSameOriginRequest, isSafeNextPath } from "@/lib/auth";
import { routes } from "@/lib/routes";
import {
  AuthError,
  getAuthService,
  getCartService,
  getCustomerService,
  getCustomerProfileService,
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
  const next = safeNext(field(formData, "next"));
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirmPassword") ?? "")) {
    redirect(
      `${routes.register()}?error=${encodeURIComponent("Those passwords do not match.")}&email=${encodeURIComponent(field(formData, "email"))}&name=${encodeURIComponent(field(formData, "name"))}&next=${encodeURIComponent(next)}`,
    );
  }
  try {
    await getAuthService().register({
      name: field(formData, "name"),
      email: field(formData, "email"),
      password,
    });
  } catch (error) {
    authError(routes.register(), error, "Could not create your account. Please try again.");
  }
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
  const token = field(formData, "token");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirmPassword") ?? "")) {
    redirect(
      `${routes.resetPassword(token)}?error=${encodeURIComponent("Those passwords do not match.")}`,
    );
  }
  try {
    await getAuthService().resetPassword({ token, password });
  } catch (error) {
    if (error instanceof AuthError && error.code === "expired-token") {
      redirect(
        `${routes.resetPassword(token)}?error=${encodeURIComponent(error.message)}&code=expired-token`,
      );
    }
    authError(
      routes.resetPassword(token),
      error,
      "Could not reset your password. Request a fresh link.",
    );
  }
  redirect(`${routes.login()}?reset=success`);
}

export async function resendActivationAction(formData: FormData): Promise<void> {
  const email = field(formData, "email");
  try {
    await getAuthService().resendActivation(email);
  } catch {
    redirect(
      `${routes.login()}?error=${encodeURIComponent("Could not resend that email. Please try again.")}`,
    );
  }
  redirect(
    `${routes.login()}?notice=${encodeURIComponent(`Activation email re-sent to ${email}. Please check your inbox.`)}`,
  );
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
  redirect(routes.account());
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
  const productId = field(formData, "productId");
  await getWishlistService().removeItem(productId);
  revalidatePath(routes.home());
  revalidatePath(routes.accountWishlist());
  redirect(routes.accountWishlist());
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
    authError(
      routes.accountSettings(),
      error,
      "Could not save your profile. Please try again.",
    );
  }
  revalidatePath(routes.account());
  redirect(`${routes.accountSettings()}?saved=profile`);
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
