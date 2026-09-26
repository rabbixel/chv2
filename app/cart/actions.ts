"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { getCartService } from "@/lib/services";
import type { Cart, ID, LicenseCode } from "@/lib/types";

/**
 * Cart mutations behind the service layer. Reads stay in server components
 * via `getCartService()`; these actions are the only client entry points.
 * The header badge syncs through the cart-count cookie the service writes.
 */

export async function getCart(): Promise<Cart> {
  return getCartService().getSessionCart();
}

export async function addToCart(
  productId: ID,
  license: LicenseCode,
): Promise<{ itemCount: number }> {
  const cart = await getCartService().addItem(productId, license);
  revalidatePath(routes.cart());
  revalidatePath(routes.checkout());
  return { itemCount: cart.itemCount };
}

function cartError(message: string): never {
  redirect(`${routes.cart()}?error=${encodeURIComponent(message)}`);
}

export async function removeFromCart(formData: FormData): Promise<void> {
  const key = String(formData.get("key") ?? "");
  try {
    await getCartService().removeItem(key);
  } catch {
    cartError("Could not remove that item. Please try again.");
  }
  revalidatePath(routes.cart());
  revalidatePath(routes.checkout());
  redirect(routes.cart());
}

export async function updateCart(formData: FormData): Promise<void> {
  const key = String(formData.get("key") ?? "");
  const license = String(formData.get("license") ?? "");
  try {
    await getCartService().updateItem(key, license as LicenseCode);
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
