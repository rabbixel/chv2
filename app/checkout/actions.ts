"use server";

import { cookies } from "next/headers";
import { assertSameOriginRequest } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createHmac, timingSafeEqual } from "node:crypto";
import { guestSafeApiFetch } from "@/lib/services/guestSafeRequest";
import { apiEndpoints } from "@/lib/api/endpoints";
import { getAuthService, getCartService, getCheckoutService, getFreeCheckoutSelection, resolveFreeCheckoutCart, isWordPressAuthEnabled } from "@/lib/services";
import { freeCheckoutCookieOptions, validateFreeCheckoutSession } from "@/lib/services/freeCheckoutService";
import type { CheckoutBilling, CheckoutQuote, CartLineIdentity, CheckoutCartLine } from "@/lib/types";
import { routes } from "@/lib/routes";
import { isValidPhoneNumber, normalizePhoneNumber, PHONE_ERROR } from "@/lib/validation/phone";
import { parseRazorpayVerificationResponse } from "@/lib/payments/razorpayVerificationResponse.mjs";
import { downloadFailureKind, type DownloadFailureKind } from "@/lib/payments/downloadFailure.mjs";
import { ApiError } from "@/lib/api/client";
import { checkoutStatusAllowsCartCleanup } from "@/lib/services/checkoutCartCleanup.mjs";

export interface CheckoutQuoteActionResult {
  quote?: CheckoutQuote;
  error?: string;
}
export interface CheckoutDownloadsResult {
  downloads: CheckoutOrderDownloads | null;
  error: DownloadFailureKind | null;
}
const PAYMENT_AUTH_COOKIE = "ch_payment_auth";
const CHECKOUT_CART_COOKIE = "ch_checkout_cart";
function authorizationCookie(freeSessionId?: string) {
  return freeSessionId === undefined ? PAYMENT_AUTH_COOKIE : `ch_free_payment_${validateFreeCheckoutSession(freeSessionId)}`;
}
function value(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

async function paymentBridgeRequest<T>(path: string, body: unknown): Promise<T> {
  // The retry carries the same order-scoped capability. WordPress rejects it
  // for orders owned by another logged-in customer.
  return guestSafeApiFetch<T>(path, { method: "POST", body, cache: "no-store", redirect: "error", timeoutMs: 25_000 });
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
  country?: unknown; region?: unknown; phone?: unknown; discountCode?: unknown; freeSessionId?: string;
}): Promise<CheckoutQuoteActionResult> {
  await assertSameOriginRequest();
  try {
    const cart = input.freeSessionId === undefined ? await getCartService().getSessionCart()
      : await resolveFreeCheckoutCart(await getFreeCheckoutSelection(input.freeSessionId));
    const country = value(input.country).toUpperCase();
    const region = value(input.region);
    const phone = normalizePhoneNumber(value(input.phone));
    if (country.length > 2 || !/^[A-Z]{0,2}$/.test(country) || region.length > 100) throw new Error("Check your billing country or region.");
    if (!phone || !isValidPhoneNumber(phone)) throw new Error(PHONE_ERROR);
    const quote = await getCheckoutService().quote({ cart, billing: { country, region, phone }, discountCode: input.freeSessionId === undefined ? value(input.discountCode).toUpperCase() : "", independentFree: input.freeSessionId !== undefined });
    if (input.freeSessionId !== undefined && quote.total.amount !== 0) throw new Error("This product is no longer free.");
    return { quote };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not calculate checkout totals." };
  }
}

export interface CheckoutPreparationResult {
  order?: { number: string; status: "pending" | "complete"; total: CheckoutQuote["total"] };
  error?: string;
}

export async function preparePendingOrder(formData: FormData, freeSessionId?: string): Promise<CheckoutPreparationResult> {
  await assertSameOriginRequest();
  const terms = value(formData.get("terms"));
  if (terms !== "accepted") return { error: "Accept the Terms and Privacy Policy to continue." };
  const idempotencyKey = value(formData.get("idempotencyKey"));
  if (!/^[a-f0-9-]{36}$/i.test(idempotencyKey)) return { error: "Your checkout session expired. Refresh checkout and try again." };

  try {
    const selection = freeSessionId === undefined ? null : await getFreeCheckoutSelection(freeSessionId);
    if (selection && idempotencyKey !== selection.idempotencyKey) throw new Error("Your free checkout session expired. Refresh and try again.");
    // EDD replays this session's order even after it consumed the final unit.
    // New orders still undergo authoritative purchase-limit validation.
    const cart = selection ? await resolveFreeCheckoutCart(selection, true) : await getCartService().getSessionCart();
    if (!cart.items.length || cart.items.some((item) => item.available === false)) return { error: "Your cart has unavailable items. Return to your cart and remove them." };
    const billing = await billingFromInput({
      fullName: formData.get("fullName"), email: formData.get("email"),
      phone: formData.get("phone"),
      country: formData.get("country"), region: formData.get("region"),
    });
    const discountCode = selection ? "" : value(formData.get("discountCode")).toUpperCase();
    const result = await getCheckoutService().prepare({ cart, billing, discountCode, idempotencyKey, independentFree: Boolean(selection) });
    if (selection && (result.status !== "complete" || result.total.amount !== 0)) throw new Error("The free order could not be completed. Retry with the same checkout session.");
    if ((result.status === "pending" || result.status === "complete") && result.payment_authorization_token && /^[a-f0-9]{64}$/.test(result.payment_authorization_token)) {
      const cookieJar = await cookies();
      const cookieOptions = freeSessionId !== undefined ? freeCheckoutCookieOptions(freeSessionId) : {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/checkout", maxAge: 60 * 60 * 24 * 2,
      };
      cookieJar.set(authorizationCookie(freeSessionId), `${result.id}.${result.payment_authorization_token}.${encodeURIComponent(result.number)}`, cookieOptions);
      if (!selection) {
        const lines: CheckoutCartLine[] = cart.items.map((item) => ({ productId: item.productId, priceId: item.priceId ?? null, quantity: item.quantity }));
        const snapshotPayload = Buffer.from(JSON.stringify({ order: result.number, lines })).toString("base64url");
        const snapshotSignature = createHmac("sha256", result.payment_authorization_token).update(snapshotPayload).digest("base64url");
        cookieJar.set(CHECKOUT_CART_COOKIE, `${snapshotPayload}.${snapshotSignature}`, cookieOptions);
      }
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
  fulfilled: boolean;
  edd_order_reference: string;
}

export interface CheckoutOrderStatus {
  edd_order_reference: string;
  order_status: "pending" | "complete" | "partially_refunded";
  payment_status: "" | "authorized" | "captured" | "failed";
  fulfilled: boolean;
  free_completed: boolean;
}

export interface CheckoutOrderDownloads {
  order: string;
  items: Array<{ order_item_id: number; title: string; files: Array<{ key: string; name: string }> }>;
}

function paymentCapability(orderReference: string) {
  const cleanReference = value(orderReference);
  if (!/^[A-Za-z0-9-]{1,40}$/.test(cleanReference)) throw new Error("This order is not eligible for payment.");
  return cleanReference;
}

async function getPaymentAuthorization(orderReference: string, freeSessionId?: string) {
  const cleanReference = paymentCapability(orderReference);
  const cookie = (await cookies()).get(authorizationCookie(freeSessionId))?.value ?? "";
  const match = cookie.match(/^([1-9][0-9]*)\.([a-f0-9]{64})\.([A-Za-z0-9-]{1,40})$/);
  if (!match || match[3] !== cleanReference || !Number.isSafeInteger(Number(match[1]))) throw new Error("This order is not eligible for payment.");
  return { orderId: Number(match[1]), token: match[2] };
}

/** Read minimal order state on the server using the HttpOnly order capability. */
export async function getCheckoutOrderStatus(orderReference: string, freeSessionId?: string): Promise<CheckoutOrderStatus | null> {
  try {
    const { orderId, token } = await getPaymentAuthorization(orderReference, freeSessionId);
    const response = await paymentBridgeRequest<unknown>(apiEndpoints.razorpayOrderStatus, { order_id: orderId, authorization_token: token });
    if (typeof response !== "object" || response === null) return null;
    const envelope = response as { success?: unknown; data?: Partial<CheckoutOrderStatus> };
    const status = envelope.data;
    if (envelope.success !== true || !status || status.edd_order_reference !== value(orderReference) ||
      !["pending", "complete", "partially_refunded"].includes(String(status.order_status)) || !["", "authorized", "captured", "failed"].includes(String(status.payment_status)) ||
      typeof status.fulfilled !== "boolean" || typeof status.free_completed !== "boolean" ||
      (status.fulfilled && (!(["complete", "partially_refunded"] as string[]).includes(String(status.order_status)) || status.payment_status !== "captured")) ||
      (status.free_completed && (status.order_status !== "complete" || status.payment_status !== "" || status.fulfilled))) return null;
    return status as CheckoutOrderStatus;
  } catch {
    return null;
  }
}

/** Remove the checkout snapshot only after an authoritative completed-order read. */
export async function cleanupCompletedCheckoutCart(orderReference: string, freeSessionId?: string): Promise<{
  itemCount: number;
  cartItems: CartLineIdentity[];
} | null> {
  await assertSameOriginRequest();
  if (freeSessionId !== undefined) return null;
  try {
    const reference = paymentCapability(orderReference);
    const cookieJar = await cookies();
    const encoded = cookieJar.get(CHECKOUT_CART_COOKIE)?.value ?? "";
    if (!encoded || encoded.length > 12_000) return null;
    const [snapshotPayload, suppliedSignature, extraPart] = encoded.split(".");
    if (!snapshotPayload || !suppliedSignature || extraPart !== undefined || !/^[A-Za-z0-9_-]{43}$/.test(suppliedSignature)) return null;
    const { token } = await getPaymentAuthorization(reference);
    const expectedSignature = createHmac("sha256", token).update(snapshotPayload).digest();
    const suppliedSignatureBytes = Buffer.from(suppliedSignature, "base64url");
    if (suppliedSignatureBytes.length !== expectedSignature.length || !timingSafeEqual(suppliedSignatureBytes, expectedSignature)) return null;
    const snapshot = JSON.parse(Buffer.from(snapshotPayload, "base64url").toString("utf8")) as { order?: unknown; lines?: unknown };
    if (snapshot.order !== reference || !Array.isArray(snapshot.lines) || snapshot.lines.length < 1 || snapshot.lines.length > 20) return null;
    const lines: CheckoutCartLine[] = [];
    for (const candidate of snapshot.lines) {
      if (!candidate || typeof candidate !== "object") return null;
      const line = candidate as Record<string, unknown>;
      const productId = String(line.productId ?? "");
      const priceId = line.priceId === null ? null : Number(line.priceId);
      const quantity = Number(line.quantity);
      if (!/^[1-9][0-9]{0,9}$/.test(productId) ||
        (priceId !== null && (!Number.isSafeInteger(priceId) || priceId < 0)) ||
        !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) return null;
      lines.push({ productId, priceId, quantity });
    }

    // This read uses the same HttpOnly order capability as checkout status.
    const status = await getCheckoutOrderStatus(reference);
    if (!checkoutStatusAllowsCartCleanup(status)) return null;

    const cart = await getCartService().removeCheckoutItems(lines);
    cookieJar.set(CHECKOUT_CART_COOKIE, "", { path: "/checkout", maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" });
    revalidatePath(routes.cart());
    revalidatePath(routes.checkout());
    return {
      itemCount: cart.itemCount,
      cartItems: cart.items.map((item) => ({ productId: item.productId, priceId: item.priceId ?? null })),
    };
  } catch {
    return null;
  }
}

/** File names are read through the order capability; no storage URLs are returned here. */
export async function getCompletedOrderDownloads(orderReference: string, freeSessionId?: string): Promise<CheckoutDownloadsResult> {
  try {
    const { orderId, token } = await getPaymentAuthorization(orderReference, freeSessionId);
    const response = await paymentBridgeRequest<unknown>(apiEndpoints.razorpayOrderDownloads, { order_id: orderId, authorization_token: token });
    if (typeof response !== "object" || response === null) return { downloads: null, error: "temporary" };
    const envelope = response as { success?: unknown; data?: { order?: unknown; items?: unknown } };
    const data = envelope.data;
    if (envelope.success !== true || !data || data.order !== value(orderReference) || !Array.isArray(data.items)) return { downloads: null, error: "temporary" };
    const items = data.items.filter((item): item is CheckoutOrderDownloads["items"][number] => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as CheckoutOrderDownloads["items"][number];
      return Number.isSafeInteger(candidate.order_item_id) && candidate.order_item_id > 0 && typeof candidate.title === "string" &&
        Array.isArray(candidate.files) && candidate.files.every((file) => typeof file?.key === "string" && typeof file?.name === "string");
    });
    return { downloads: { order: value(data.order), items }, error: null };
  } catch (error) {
    return { downloads: null, error: downloadFailureKind(error instanceof ApiError ? error.status : undefined) };
  }
}

/** Request a fresh native EDD link after revalidating the current order capability. */
export async function getCompletedOrderDownloadUrl(
  orderReference: string,
  orderItemId: number,
  fileKey: string,
  freeSessionId?: string,
): Promise<{ url?: string; error?: DownloadFailureKind }> {
  await assertSameOriginRequest();
  try {
    if (!Number.isSafeInteger(orderItemId) || orderItemId < 1 || !/^[A-Za-z0-9_-]{1,80}$/.test(fileKey)) return { error: "authorization" };
    const { orderId, token } = await getPaymentAuthorization(orderReference, freeSessionId);
    const response = await paymentBridgeRequest<unknown>(apiEndpoints.razorpayOrderDownload, {
      order_id: orderId, authorization_token: token, order_item_id: orderItemId, file_key: fileKey,
    });
    if (typeof response !== "object" || response === null) return { error: "temporary" };
    const envelope = response as { success?: unknown; data?: { url?: unknown } };
    if (envelope.success !== true || typeof envelope.data?.url !== "string") return { error: "temporary" };
    const target = new URL(envelope.data.url);
    const wordpressOrigin = new URL(process.env.CH_API_URL ?? "").origin;
    if (!["http:", "https:"].includes(target.protocol) || target.origin !== wordpressOrigin || target.username || target.password) {
      return { error: "temporary" };
    }
    return { url: target.toString() };
  } catch (error) {
    return { error: downloadFailureKind(error instanceof ApiError ? error.status : undefined) };
  }
}

/** Creates/reuses a server-authoritative Razorpay order; no EDD status is changed here. */
export async function createRazorpayOrder(orderReference: string): Promise<RazorpayOrderDetails> {
  await assertSameOriginRequest();
  const { orderId, token } = await getPaymentAuthorization(orderReference);
  const response = await paymentBridgeRequest<{ success: boolean; data: RazorpayOrderDetails }>(apiEndpoints.razorpayOrderCreate, { order_id: orderId, authorization_token: token });
  if (!response.success || response.data.currency !== "INR" || !/^order_[A-Za-z0-9]+$/.test(response.data.razorpay_order_id) || !Number.isSafeInteger(response.data.amount)) {
    throw new Error("Payment setup could not be completed.");
  }
  return response.data;
}

export async function verifyRazorpayPayment(
  orderReference: string,
  details: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string },
): Promise<RazorpayVerificationResult> {
  await assertSameOriginRequest();
  const { orderId, token } = await getPaymentAuthorization(orderReference);
  if (!/^pay_[A-Za-z0-9]+$/.test(details.razorpay_payment_id) || !/^order_[A-Za-z0-9]+$/.test(details.razorpay_order_id) || !/^[a-f0-9]{64}$/.test(details.razorpay_signature)) {
    throw new Error("Payment verification details are invalid.");
  }
  const response = await paymentBridgeRequest<unknown>(apiEndpoints.razorpayPaymentVerify, { order_id: orderId, authorization_token: token, ...details });
  return parseRazorpayVerificationResponse(response);
}
