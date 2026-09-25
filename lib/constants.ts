/**
 * Site-wide constants. Browser-safe (no secrets here, ever).
 */

export const SITE = {
  name: "Creative Hatti",
  tagline: "Premium digital creative assets",
  description:
    "Creative Hatti is a curated marketplace for fonts, graphics, templates and design resources.",
  locale: "en-IN",
  currency: "INR",
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000",
} as const;

export const PAGINATION = {
  defaultPageSize: readEnvInt("NEXT_PUBLIC_DEFAULT_PAGE_SIZE", 24, 1, 96),
  maxPageSize: 96,
  /** How many page buttons the Pagination component renders around current. */
  siblingCount: 1,
} as const;

function readEnvInt(
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export const CART_COOKIE = "ch_cart";
/** Non-httpOnly mirror of the item count so the header badge stays live. */
export const CART_COUNT_COOKIE = "ch_cart_count";
/** HttpOnly session id for the signed-in customer (mock + backend). */
export const AUTH_SESSION_COOKIE = "ch_session";

/**
 * Window event fired after same-page cart mutations (product-page
 * add-to-cart) with `{ count: number }` detail for the header badge.
 */
export const CART_UPDATED_EVENT = "ch:cart-updated";
