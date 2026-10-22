"use server";

import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { getWordPressOptionalSessionBridgeHeaders } from "@/lib/services/authService";
import { getAuthService, getCartService, getCheckoutService, isWordPressAuthEnabled } from "@/lib/services";
import type { CheckoutBilling, CheckoutQuote } from "@/lib/types";
import { isValidPhoneNumber, normalizePhoneNumber, PHONE_ERROR } from "@/lib/validation/phone";

export interface CheckoutQuoteActionResult {
  quote?: CheckoutQuote;
  error?: string;
}
const PAYMENT_AUTH_COOKIE = "ch_payment_auth";
function value(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

async function billingFromInput(input: {
  fullName?: unknown; email?: unknown; phone?: unknown; country?: unknown; region?: unknown;
}): Promise<CheckoutBilling> {
  const identity = isWordPressAuthEnabled() ? await getAuthService().getCurrentIdentity() : null;
  const fullName = identity
    ? [identity.user.firstName, identity.user.lastName].filter(Boolean).join(" ") || value(input.fullName)
    : value(input.fullName);
  const email = identity?.user.email ?? value(input.email).toLowerCase();
  const phone = normalizePhoneNumber(value(input.phone));
  const country = value(input.country).toUpperCase();
  const region = value(input.region);
  if (fullName.length < 2 || fullName.length > 120) throw new Error("Enter your billing name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) throw new Error("Enter a valid billing email.");
  if (!phone || !isValidPhoneNumber(phone)) throw new Error(PHONE_ERROR);
  if (country.length > 2 || !/^[A-Z]{0,2}$/.test(country) || region.length > 100) throw new Error("Check your billing country or region.");
  return { fullName, email, phone, country, region };
}

export async function quoteCheckout(input: {
  country?: unknown; region?: unknown; phone?: unknown; discountCode?: unknown;
}): Promise<CheckoutQuoteActionResult> {
  try {
    const cart = await getCartService().getSessionCart();
    const country = value(input.country).toUpperCase();
    const region = value(input.region);
    const phone = normalizePhoneNumber(value(input.phone));
    if (country.length > 2 || !/^[A-Z]{0,2}$/.test(country) || region.length > 100) throw new Error("Check your billing country or region.");
    if (!phone || !isValidPhoneNumber(phone)) throw new Error(PHONE_ERROR);
    const quote = await getCheckoutService().quote({ cart, billing: { country, region, phone }, discountCode: value(input.discountCode).toUpperCase() });
    return { quote };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not calculate checkout totals." };
  }
}

export interface CheckoutPreparationResult {
  order?: { number: string; status: "pending" | "complete"; total: CheckoutQuote["total"] };
  error?: string;
}

export async function preparePendingOrder(formData: FormData): Promise<CheckoutPreparationResult> {
  const terms = value(formData.get("terms"));
  if (terms !== "accepted") return { error: "Accept the Terms and Privacy Policy to continue." };
  const idempotencyKey = value(formData.get("idempotencyKey"));
  if (!/^[a-f0-9-]{36}$/i.test(idempotencyKey)) return { error: "Your checkout session expired. Refresh checkout and try again." };

  try {
    const cart = await getCartService().getSessionCart();
    if (!cart.items.length || cart.items.some((item) => item.available === false)) return { error: "Your cart has unavailable items. Return to your cart and remove them." };
    const billing = await billingFromInput({
      fullName: formData.get("fullName"), email: formData.get("email"),
      phone: formData.get("phone"),
      country: formData.get("country"), region: formData.get("region"),
    });
    const discountCode = value(formData.get("discountCode")).toUpperCase();
    const result = await getCheckoutService().prepare({ cart, billing, discountCode, idempotencyKey });
    if (result.status === "pending" && result.payment_authorization_token && /^[a-f0-9]{64}$/.test(result.payment_authorization_token)) {
      (await cookies()).set(PAYMENT_AUTH_COOKIE, `${result.id}.${result.payment_authorization_token}.${encodeURIComponent(result.number)}`, {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/checkout", maxAge: 60 * 60 * 24 * 2,
      });
    }
    return { order: { number: result.number, status: result.status, total: result.total } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare your order.";
    return { error: message };
  }
}

export interface RazorpayOrderDetails {
  key_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: "INR";
  edd_order_reference: string;
}

export interface RazorpayVerificationResult {
  status: "authorized" | "captured";
  verified: true;
  fulfilled: false;
  edd_order_reference: string;
}

function paymentCapability(orderReference: string) {
  const cleanReference = value(orderReference);
  if (!/^[A-Za-z0-9-]{1,40}$/.test(cleanReference)) throw new Error("This order is not eligible for payment.");
  return cleanReference;
}

async function getPaymentAuthorization(orderReference: string) {
  const cleanReference = paymentCapability(orderReference);
  const cookie = (await cookies()).get(PAYMENT_AUTH_COOKIE)?.value ?? "";
  const match = cookie.match(/^([1-9][0-9]*)\.([a-f0-9]{64})\.([A-Za-z0-9-]{1,40})$/);
  if (!match || match[3] !== cleanReference || !Number.isSafeInteger(Number(match[1]))) throw new Error("This order is not eligible for payment.");
  return { orderId: Number(match[1]), token: match[2] };
}

/** Creates/reuses a server-authoritative Razorpay order; no EDD status is changed here. */
export async function createRazorpayOrder(orderReference: string): Promise<RazorpayOrderDetails> {
  const { orderId, token } = await getPaymentAuthorization(orderReference);
  const headers = await getWordPressOptionalSessionBridgeHeaders();
  const response = await apiFetch<{ success: boolean; data: RazorpayOrderDetails }>(apiEndpoints.razorpayOrderCreate, {
    method: "POST", body: { order_id: orderId, authorization_token: token }, headers,
    cache: "no-store", redirect: "error", timeoutMs: 25_000,
  });
  if (!response.success || response.data.currency !== "INR" || !/^order_[A-Za-z0-9]+$/.test(response.data.razorpay_order_id) || !Number.isSafeInteger(response.data.amount)) {
    throw new Error("Payment setup could not be completed.");
  }
  return response.data;
}

export async function verifyRazorpayPayment(
  orderReference: string,
  details: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string },
): Promise<RazorpayVerificationResult> {
  const { orderId, token } = await getPaymentAuthorization(orderReference);
  if (!/^pay_[A-Za-z0-9]+$/.test(details.razorpay_payment_id) || !/^order_[A-Za-z0-9]+$/.test(details.razorpay_order_id) || !/^[a-f0-9]{64}$/.test(details.razorpay_signature)) {
    throw new Error("Payment verification details are invalid.");
  }
  const headers = await getWordPressOptionalSessionBridgeHeaders();
  const response = await apiFetch<{ success: boolean; data: RazorpayVerificationResult }>(apiEndpoints.razorpayPaymentVerify, {
    method: "POST", body: { order_id: orderId, authorization_token: token, ...details }, headers,
    cache: "no-store", redirect: "error", timeoutMs: 25_000,
  });
  if (!response.success || response.data.verified !== true || response.data.fulfilled !== false || !["authorized", "captured"].includes(response.data.status)) {
    throw new Error("Payment could not be verified. Your order remains pending.");
  }
  return response.data;
}
