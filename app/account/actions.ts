"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSafeNextPath } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { AuthError, getAuthService, toAuthError } from "@/lib/services";

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
      "Could not log you in. Please try again.",
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
