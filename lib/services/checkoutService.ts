import "server-only";

import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { getWordPressBridgeHeaders, getWordPressOptionalSessionBridgeHeaders } from "./authService";
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
  private async request<T>(path: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
    const headers = await getWordPressOptionalSessionBridgeHeaders();
    const result = await apiFetch<Envelope<T>>(path, {
      method: "POST", body, headers: { ...headers, ...extraHeaders }, cache: "no-store", redirect: "error", timeoutMs: 15_000,
    });
    return result.data;
  }

  private async requestGuestSafe<T>(path: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
    try {
      return await this.request<T>(path, body, extraHeaders);
    } catch (error) {
      // An invalid session is no longer an authenticated identity. Retry only
      // guest-safe checkout operations through the trusted bridge as a guest.
      if (!(error instanceof ApiError && error.status === 401 && error.code === "invalid_session")) throw error;
      const response = await apiFetch<Envelope<T>>(path, {
        method: "POST", body, headers: { ...getWordPressBridgeHeaders(), ...extraHeaders },
        cache: "no-store", redirect: "error", timeoutMs: 15_000,
      });
      return response.data;
    }
  }

  async quote(input: { cart: Cart; billing: Pick<CheckoutBilling, "country" | "region"> & Partial<Pick<CheckoutBilling, "phone">>; discountCode?: string }): Promise<CheckoutQuote> {
    const body = {
      items: cartItems(input.cart), billing: { country: input.billing.country, region: input.billing.region, ...(input.billing.phone ? { phone: input.billing.phone } : {}) }, discount_code: input.discountCode ?? "",
    };
    const raw = await this.requestGuestSafe<{
      currency: string; subtotal: CheckoutQuote["subtotal"]; discount: CheckoutQuote["discount"];
      tax: CheckoutQuote["tax"]; total: CheckoutQuote["total"]; discount_code?: string; taxes_enabled: boolean;
    }>(apiEndpoints.checkoutQuote, body);
    return { ...raw, discountCode: raw.discount_code, taxesEnabled: raw.taxes_enabled };
  }

  prepare(input: { cart: Cart; billing: CheckoutBilling; discountCode?: string; idempotencyKey: string }): Promise<PendingCheckoutOrder> {
    return this.request(apiEndpoints.checkoutPrepare, {
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
    }, { "Idempotency-Key": input.idempotencyKey });
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
