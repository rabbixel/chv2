import type { Wishlist, WishlistItem } from "@/lib/types";

export type WishlistProductLookup =
  | { kind: "id"; value: string }
  | { kind: "slug"; value: string };

export function shouldSeedDemoWishlist(authMode: string | undefined): boolean {
  return authMode !== "wordpress";
}

/** Normalize integer IDs from older WordPress/API payloads into the app ID type. */
export function normalizeWishlist(wishlist: Wishlist): Wishlist {
  return {
    ...wishlist,
    id: String(wishlist.id),
    customerId: String(wishlist.customerId),
    items: wishlist.items.map((item) => ({
      ...item,
      productId: String(item.productId),
      addedAt: String(item.addedAt),
    })),
  };
}

/** Resolve current numeric WP product IDs and the older `prod-{slug}` shape. */
export function wishlistProductLookup(productId: string | number): WishlistProductLookup | null {
  const id = String(productId).trim();
  const wordpressId = id.replace(/^wp-/, "");
  if (/^[1-9][0-9]{0,9}$/.test(wordpressId)) return { kind: "id", value: wordpressId };
  const slug = id.replace(/^prod-/, "");
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)
    ? { kind: "slug", value: slug }
    : null;
}

/** Prefer the original attachment URL when product data provides one. */
export function wishlistImageSource(
  image: { originalUrl?: string | null; url?: string | null } | null | undefined,
): string | null {
  const source = image?.originalUrl?.trim() || image?.url?.trim();
  return source || null;
}

/** Keep one display row per saved record, even when its product was removed. */
export function wishlistViewRows<TProduct>(
  items: readonly WishlistItem[],
  products: readonly (TProduct | null)[],
) {
  return items.map((item, index) => ({
    key: `${item.productId}:${item.addedAt}:${index}`,
    item,
    product: products[index] ?? null,
  }));
}

export function setWishlistItem(
  items: readonly WishlistItem[],
  productId: string,
  saved: boolean,
  addedAt: string,
): WishlistItem[] {
  if (!saved) return items.filter((item) => item.productId !== productId);
  if (items.some((item) => item.productId === productId)) return [...items];
  return [...items, { productId, addedAt }];
}
