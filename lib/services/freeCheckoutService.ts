import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getProductService } from "./productService";
import { getCheckoutService } from "./checkoutService";
import type { Cart } from "@/lib/types";

export interface FreeCheckoutSelection {
  slug: string;
  priceId: number | null;
  idempotencyKey: string;
  taxesEnabled: boolean;
}

export function validateFreeCheckoutSession(id: string): string {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) {
    throw new Error("Your free checkout session expired. Return to the product and try again.");
  }
  return id;
}

export function freeCheckoutCookieOptions(id: string) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const,
    path: `/checkout/free/${validateFreeCheckoutSession(id)}`, maxAge: 60 * 60 * 24 * 2 };
}

/** An isolated item projection, never a read or write of the customer's cart. */
export async function resolveFreeCheckoutCart(selection: Pick<FreeCheckoutSelection, "slug" | "priceId">, resume = false): Promise<Cart> {
  const product = await getProductService().getProductForQuickAdd(selection.slug);
  if (!product || product.status !== "active" || (!resume && (product.soldOut || product.purchasable === false)) || product.priceValid === false) {
    throw new Error("This free download is currently unavailable.");
  }
  const options = product.priceOptions;
  const option = options?.find((entry) => entry.id === selection.priceId);
  if (options !== undefined ? !option || option.price.amount !== 0 : selection.priceId !== null || product.price.amount !== 0) {
    throw new Error("Select an available free price option.");
  }
  const zero = { amount: 0, currency: product.price.currency };
  return { id: "independent-free", currency: zero.currency, itemCount: 1, subtotal: zero, total: zero,
    updatedAt: new Date().toISOString(), items: [{ key: `${product.id}:${selection.priceId ?? "single"}`,
      productId: product.id, productSlug: product.slug, title: product.title, thumbnailUrl: product.images[0]?.url,
      priceId: selection.priceId, optionName: option?.name, license: product.licenses[0] ?? "personal",
      quantity: 1, unitPrice: zero, lineTotal: zero, available: true }] };
}

export async function createFreeCheckoutSession(slug: string, priceId: number | null): Promise<string> {
  if (typeof slug !== "string" || !/^[\w-]{1,250}$/.test(slug) ||
      (priceId !== null && (!Number.isSafeInteger(priceId) || priceId < 0))) throw new Error("Choose an available free product.");
  const cart = await resolveFreeCheckoutCart({ slug, priceId });
  const quote = await getCheckoutService().quote({ cart, billing: { country: "IN", region: "" }, independentFree: true });
  if (quote.total.amount !== 0 || quote.subtotal.amount !== 0 || quote.tax.amount !== 0) {
    throw new Error("This product is no longer free.");
  }
  const id = randomUUID();
  const selection: FreeCheckoutSelection = { slug, priceId, idempotencyKey: randomUUID(), taxesEnabled: quote.taxesEnabled };
  (await cookies()).set(`ch_free_selection_${id}`, JSON.stringify(selection), freeCheckoutCookieOptions(id));
  return id;
}

export async function getFreeCheckoutSelection(id: string): Promise<FreeCheckoutSelection> {
  validateFreeCheckoutSession(id);
  const encoded = (await cookies()).get(`ch_free_selection_${id}`)?.value;
  if (!encoded || encoded.length > 1000) throw new Error("Your free checkout session expired. Return to the product and try again.");
  const selection = JSON.parse(encoded) as FreeCheckoutSelection;
  if (typeof selection.slug !== "string" || !/^[\w-]{1,250}$/.test(selection.slug) ||
      (selection.priceId !== null && (!Number.isSafeInteger(selection.priceId) || selection.priceId < 0))) throw new Error("Invalid free checkout session.");
  validateFreeCheckoutSession(selection.idempotencyKey);
  return selection;
}
