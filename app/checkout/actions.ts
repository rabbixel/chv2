"use server";

import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { getAuthService, getCartService, getCheckoutService, isWordPressAuthEnabled } from "@/lib/services";
import type { CheckoutBilling, CheckoutQuote } from "@/lib/types";

export interface CheckoutQuoteActionResult {
  quote?: CheckoutQuote;
  error?: string;
}
function value(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

async function billingFromInput(input: {
  fullName?: unknown; email?: unknown; country?: unknown; region?: unknown;
}): Promise<CheckoutBilling> {
  const identity = isWordPressAuthEnabled() ? await getAuthService().getCurrentIdentity() : null;
  const fullName = identity
    ? [identity.user.firstName, identity.user.lastName].filter(Boolean).join(" ") || value(input.fullName)
    : value(input.fullName);
  const email = identity?.user.email ?? value(input.email).toLowerCase();
  const country = value(input.country).toUpperCase();
  const region = value(input.region);
  if (fullName.length < 2 || fullName.length > 120) throw new Error("Enter your billing name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) throw new Error("Enter a valid billing email.");
  if (country.length > 2 || !/^[A-Z]{0,2}$/.test(country) || region.length > 100) throw new Error("Check your billing country or region.");
  return { fullName, email, country, region };
}

export async function quoteCheckout(input: {
  country?: unknown; region?: unknown; discountCode?: unknown;
}): Promise<CheckoutQuoteActionResult> {
  try {
    const cart = await getCartService().getSessionCart();
    const country = value(input.country).toUpperCase();
    const region = value(input.region);
    if (country.length > 2 || !/^[A-Z]{0,2}$/.test(country) || region.length > 100) throw new Error("Check your billing country or region.");
    const quote = await getCheckoutService().quote({ cart, billing: { country, region }, discountCode: value(input.discountCode).toUpperCase() });
    return { quote };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not calculate checkout totals." };
  }
}

export async function preparePendingOrder(formData: FormData): Promise<void> {
  const terms = value(formData.get("terms"));
  if (terms !== "accepted") redirect(`${routes.checkout()}?error=terms`);
  const idempotencyKey = value(formData.get("idempotencyKey"));
  if (!/^[a-f0-9-]{36}$/i.test(idempotencyKey)) redirect(`${routes.checkout()}?error=session`);

  try {
    const cart = await getCartService().getSessionCart();
    if (!cart.items.length || cart.items.some((item) => item.available === false)) redirect(`${routes.checkout()}?error=cart`);
    const billing = await billingFromInput({
      fullName: formData.get("fullName"), email: formData.get("email"),
      country: formData.get("country"), region: formData.get("region"),
    });
    const discountCode = value(formData.get("discountCode")).toUpperCase();
    const result = await getCheckoutService().prepare({ cart, billing, discountCode, idempotencyKey });
    redirect(`${routes.checkout()}?prepared=${encodeURIComponent(result.number)}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "Could not prepare your order.";
    const code = /zero.total|zero_total/i.test(message) ? "zero-total" : /discount|coupon/i.test(message) ? "discount" : "prepare";
    redirect(`${routes.checkout()}?error=${code}`);
  }
}
