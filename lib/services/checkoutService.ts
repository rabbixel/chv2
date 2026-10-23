import "server-only";

import { apiEndpoints } from "@/lib/api/endpoints";
import { guestSafeApiFetch } from "./guestSafeRequest";
import { isLiveApiEnabled } from "./apiMode";
import type { Cart, CheckoutBilling, CheckoutQuote, PendingCheckoutOrder } from "@/lib/types";

export interface CheckoutService {
  quote(input: { cart: Cart; billing: Pick<CheckoutBilling, "country" | "region"> & Partial<Pick<CheckoutBilling, "phone">>; discountCode?: string }): Promise<CheckoutQuote>;
  prepare(input: { cart: Cart; billing: CheckoutBilling; discountCode?: string; idempotencyKey: string }): Promise<PendingCheckoutOrder>;
}

interface Envelope<T> { success: boolean; data: T }

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
  async quote(input: { cart: Cart; billing: Pick<CheckoutBilling, "country" | "region"> & Partial<Pick<CheckoutBilling, "phone">>; discountCode?: string }): Promise<CheckoutQuote> {
    const body = {
      items: cartItems(input.cart), billing: { country: input.billing.country, region: input.billing.region, ...(input.billing.phone ? { phone: input.billing.phone } : {}) }, discount_code: input.discountCode ?? "",
    };
    const envelope = await guestSafeApiFetch<Envelope<{
      currency: string; subtotal: CheckoutQuote["subtotal"]; discount: CheckoutQuote["discount"];
      tax: CheckoutQuote["tax"]; total: CheckoutQuote["total"]; discount_code?: string; taxes_enabled: boolean;
    }>>(apiEndpoints.checkoutQuote, { method: "POST", body, cache: "no-store", redirect: "error", timeoutMs: 15_000 });
    const raw = envelope.data;
    return { ...raw, discountCode: raw.discount_code, taxesEnabled: raw.taxes_enabled };
  }

  prepare(input: { cart: Cart; billing: CheckoutBilling; discountCode?: string; idempotencyKey: string }): Promise<PendingCheckoutOrder> {
    return guestSafeApiFetch<Envelope<PendingCheckoutOrder>>(apiEndpoints.checkoutPrepare, {
      method: "POST",
      body: {
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
      headers: { "Idempotency-Key": input.idempotencyKey }, cache: "no-store", redirect: "error", timeoutMs: 15_000,
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
