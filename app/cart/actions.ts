"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { getCartService, getProductService } from "@/lib/services";
import type { Cart, CartLineIdentity, ID, LicenseCode, ProductPriceOption } from "@/lib/types";

/**
 * Cart mutations behind the service layer. Reads stay in server components
 * via `getCartService()`; these actions are the only client entry points.
 * The header badge syncs through the cart-count cookie the service writes.
 */

export async function getCart(): Promise<Cart> {
  return getCartService().getSessionCart();
}

export async function getQuickAddCartState(): Promise<CartLineIdentity[]> {
  const cart = await getCartService().getSessionCart();
  return cart.items.map((item) => ({ productId: item.productId, priceId: item.priceId ?? null }));
}

export async function addToCart(
  productId: ID,
  license: LicenseCode,
  priceId?: number | null,
): Promise<{ itemCount: number }> {
  const cart = await getCartService().addItem(productId, license, priceId);
  revalidatePath(routes.cart());
  revalidatePath(routes.checkout());
  return { itemCount: cart.itemCount };
}

export type QuickAddResult =
  | { status: "needs-options"; options: ProductPriceOption[]; cartItems: CartLineIdentity[] }
  | { status: "added" | "already"; itemCount: number; cartItems: CartLineIdentity[] }
  | { status: "unavailable" | "error"; message: string };

/** Resolve the product and current EDD options on the server before writing the existing session cart. */
export async function quickAddToCart(slug: string, selectedPriceId?: number): Promise<QuickAddResult> {
  try {
    const product = await getProductService().getProductForQuickAdd(slug);
    if (!product || product.status !== "active") {
      return { status: "unavailable", message: "This product is not currently available." };
    }

    const cartService = getCartService();
    const cart = await cartService.getSessionCart();
    const options = product.priceOptions ?? [];
    const cartItems = cart.items.map((item) => ({ productId: item.productId, priceId: item.priceId ?? null }));

    if (options.length && selectedPriceId === undefined) {
      return { status: "needs-options", options, cartItems };
    }
    if (options.length && !options.some((option) => option.id === selectedPriceId)) {
      return { status: "error", message: "Choose an available price option." };
    }
    if (!options.length && selectedPriceId !== undefined) {
      return { status: "error", message: "This product does not have that price option." };
    }

    const priceId = options.length ? selectedPriceId! : null;
    const existing = cart.items.find((item) => item.productId === product.id && (item.priceId ?? null) === priceId);
    if (existing?.available === false) return { status: "unavailable", message: existing.availabilityMessage || "This product option is unavailable." };
    if (existing) return { status: "already", itemCount: cart.itemCount, cartItems };

    const updated = await cartService.addItem(product.id, product.licenses[0] ?? "personal", priceId);
    revalidatePath(routes.cart());
    revalidatePath(routes.checkout());
    return {
      status: "added",
      itemCount: updated.itemCount,
      cartItems: updated.items.map((item) => ({ productId: item.productId, priceId: item.priceId ?? null })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add this product to your cart.";
    return /unavailable|not available|purchase limit|sold out/i.test(message)
      ? { status: "unavailable", message }
      : { status: "error", message: "Could not add this product to your cart. Please try again." };
  }
}

function cartError(message: string): never {
  redirect(`${routes.cart()}?error=${encodeURIComponent(message)}`);
}

export async function removeFromCart(key: string): Promise<{ itemCount: number; cartItems: CartLineIdentity[] }> {
  try {
    const cart = await getCartService().removeItem(key);
    revalidatePath(routes.cart());
    revalidatePath(routes.checkout());
    return {
      itemCount: cart.itemCount,
      cartItems: cart.items.map((item) => ({ productId: item.productId, priceId: item.priceId ?? null })),
    };
  } catch {
    throw new Error("Could not remove that item. Please try again.");
  }
}

export async function updateCart(formData: FormData): Promise<void> {
  const key = String(formData.get("key") ?? "");
  const license = String(formData.get("license") ?? "");
  const rawPriceId = formData.get("price_id");
  const priceId = rawPriceId === null || rawPriceId === "" ? undefined : Number(rawPriceId);
  try {
    await getCartService().updateItem(key, license as LicenseCode, priceId);
  } catch {
    cartError("Could not update that item. Please try again.");
  }
  revalidatePath(routes.cart());
  revalidatePath(routes.checkout());
  redirect(routes.cart());
}

export async function applyCoupon(formData: FormData): Promise<void> {
  const code = String(formData.get("coupon") ?? "");
  try {
    await getCartService().applyCoupon(code);
  } catch {
    redirect(
      `${routes.checkout()}?coupon=invalid&code=${encodeURIComponent(code.trim())}`,
    );
  }
  revalidatePath(routes.cart());
  revalidatePath(routes.checkout());
  redirect(
    `${routes.checkout()}?coupon=applied&code=${encodeURIComponent(code.trim().toUpperCase())}`,
  );
}

export async function removeCoupon(): Promise<void> {
  await getCartService().removeCoupon();
  revalidatePath(routes.cart());
  revalidatePath(routes.checkout());
  redirect(`${routes.checkout()}?coupon=removed`);
}

export async function clearCart(): Promise<void> {
  await getCartService().clearCart();
  revalidatePath(routes.cart());
  revalidatePath(routes.checkout());
  redirect(routes.cart());
}
