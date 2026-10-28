import "server-only";

import { headers } from "next/headers";
import { apiEndpoints } from "@/lib/api/endpoints";
import { guestSafeApiFetch } from "./guestSafeRequest";
import { isLiveApiEnabled } from "./apiMode";
import type { Cart, CheckoutBilling, CheckoutQuote, PendingCheckoutOrder } from "@/lib/types";

export interface CheckoutService {
  quote(input: { cart: Cart; billing: Pick<CheckoutBilling, "country" | "region"> & Partial<Pick<CheckoutBilling, "phone">>; discountCode?: string; independentFree?: boolean }): Promise<CheckoutQuote>;
  prepare(input: { cart: Cart; billing: CheckoutBilling; discountCode?: string; idempotencyKey: string; independentFree?: boolean }): Promise<PendingCheckoutOrder>;
}

interface Envelope<T> { success: boolean; data: T }

async function checkoutRateLimitHeaders(): Promise<Record<string, string>> {
  const token = (await headers()).get("x-ch-checkout-rate-token") ?? "";
  if (!/^([a-f0-9]{64})\.([a-f0-9]{64})$/i.test(token)) {
    throw new Error("Your checkout session is invalid. Refresh the page and try again.");
  }
  return { "X-CH-Checkout-Rate-Token": token.toLowerCase() };
}

function cartItems(cart: Cart) {
  if (!cart.items.length || cart.items.length > 20 || cart.items.some((item) => item.available === false)) {
    throw new Error("Your cart contains unavailable items. Remove them and try again.");
  }
  return cart.items.map((item) => ({
    product_id: Number(item.productId),
    price_id: item.priceId ?? null,
    quantity: item.quantity,
  }));
}

class WordPressCheckoutService implements CheckoutService {
  async quote(input: { cart: Cart; billing: Pick<CheckoutBilling, "country" | "region"> & Partial<Pick<CheckoutBilling, "phone">>; discountCode?: string; independentFree?: boolean }): Promise<CheckoutQuote> {
    const body = {
      ...(input.independentFree ? { independent_free: true } : {}),
      items: cartItems(input.cart), billing: { country: input.billing.country, region: input.billing.region, ...(input.billing.phone ? { phone: input.billing.phone } : {}) }, discount_code: input.discountCode ?? "",
    };
    const envelope = await guestSafeApiFetch<Envelope<{
      currency: string; subtotal: CheckoutQuote["subtotal"]; discount: CheckoutQuote["discount"];
      tax: CheckoutQuote["tax"]; total: CheckoutQuote["total"]; discount_code?: string; taxes_enabled: boolean;
    }>>(apiEndpoints.checkoutQuote, { method: "POST", body, headers: await checkoutRateLimitHeaders(), cache: "no-store", redirect: "error", timeoutMs: 15_000 });
    const raw = envelope.data;
    return { ...raw, discountCode: raw.discount_code, taxesEnabled: raw.taxes_enabled };
  }

  async prepare(input: { cart: Cart; billing: CheckoutBilling; discountCode?: string; idempotencyKey: string; independentFree?: boolean }): Promise<PendingCheckoutOrder> {
    const rateLimitHeaders = await checkoutRateLimitHeaders();
    return guestSafeApiFetch<Envelope<PendingCheckoutOrder>>(apiEndpoints.checkoutPrepare, {
      method: "POST",
      body: {
        ...(input.independentFree ? { independent_free: true } : {}),
        items: cartItems(input.cart),
        billing: {
          full_name: input.billing.fullName,
          email: input.billing.email,
          phone: input.billing.phone,
          country: input.billing.country,
          region: input.billing.region,
          address: input.billing.address ?? "",
          city: input.billing.city ?? "",
          postal_code: input.billing.postalCode ?? "",
        },
        discount_code: input.discountCode ?? "",
      },
      headers: { "Idempotency-Key": input.idempotencyKey, ...rateLimitHeaders }, cache: "no-store", redirect: "error", timeoutMs: 15_000,
    }).then((result) => result.data);
  }
}

let cached: CheckoutService | null = null;

export function getCheckoutService(): CheckoutService {
  if (!isLiveApiEnabled()) {
    throw new Error("Checkout requires the configured WordPress/EDD backend.");
  }
  cached ??= new WordPressCheckoutService();
  return cached;
}
