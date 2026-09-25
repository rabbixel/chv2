import { cookies } from "next/headers";
import { licenses } from "@/data/licenses";
import { products } from "@/data/products";
import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { CART_COOKIE, CART_COUNT_COOKIE } from "@/lib/constants";
import type {
  Cart,
  CartItem,
  ID,
  LicenseCode,
  Money,
  Slug,
} from "@/lib/types";

/**
 * SERVER ONLY — the mock implementation reads/writes the session cookie via
 * `next/headers`. Client components mutate through server actions
 * (`app/cart/actions.ts`), never through this module directly.
 */

export interface CartService {
  /**
   * Stable sample cart. Static-safe (no session read) — the header badge
   * uses this so marketing/listing pages keep static prerendering.
   */
  getCart(): Promise<Cart>;
  /** Current session cart (guest cookie; sample items for new sessions). */
  getSessionCart(): Promise<Cart>;
  addItem(productId: ID, license: LicenseCode): Promise<Cart>;
  updateItem(key: string, license: LicenseCode): Promise<Cart>;
  removeItem(key: string): Promise<Cart>;
  applyCoupon(code: string): Promise<Cart>;
  removeCoupon(): Promise<Cart>;
  clearCart(): Promise<Cart>;
}

/* ------------------------------ Mock ------------------------------ */

const LICENSE_CODES: LicenseCode[] = ["personal", "commercial", "extended"];

/** Mock coupons (scaffold only — the real backend owns promotions). */
const MOCK_COUPONS: Record<string, number> = {
  HATTI10: 10, // 10% off
};

const EMPTY_CART: Cart = {
  id: "cart-guest",
  currency: "INR",
  items: [],
  itemCount: 0,
  subtotal: { amount: 0, currency: "INR" },
  total: { amount: 0, currency: "INR" },
  updatedAt: new Date(0).toISOString(),
};

/** In-memory mock store (single process; the backend persists for real). */
const cartStore = new Map<string, Cart>();
let cartSeq = 0;

function multiplier(license: LicenseCode): number {
  return (
    licenses.find((entry) => entry.code === license)?.priceMultiplier ?? 1
  );
}

function toItem(productId: ID, license: LicenseCode): CartItem | null {
  const product = products.find((item) => item.id === productId);
  if (!product || !product.licenses.includes(license)) return null;
  const unitPrice: Money = {
    amount: Math.round(product.price.amount * multiplier(license)),
    currency: product.price.currency,
  };
  return {
    key: `${product.id}:${license}`,
    productId: product.id,
    productSlug: product.slug as Slug,
    title: product.title,
    license,
    quantity: 1,
    unitPrice,
    lineTotal: unitPrice,
  };
}

function withTotals(cart: Cart): Cart {
  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.lineTotal.amount,
    0,
  );
  const percent = cart.couponCode
    ? (MOCK_COUPONS[cart.couponCode] ?? 0)
    : 0;
  // Money is minor-unit (paise); keep the mock discount whole-rupee so the
  // whole-rupee display math stays exact (subtotal − discount = total).
  const discountAmount = Math.round((subtotal * percent) / 10000) * 100;
  return {
    ...cart,
    itemCount: cart.items.length,
    subtotal: { amount: subtotal, currency: cart.currency },
    discount:
      discountAmount > 0
        ? { amount: discountAmount, currency: cart.currency }
        : undefined,
    total: {
      amount: subtotal - discountAmount,
      currency: cart.currency,
    },
    updatedAt: new Date().toISOString(),
  };
}

function sampleCart(): Cart {
  const items = [
    toItem("prod-grand-diwali-collection", "commercial"),
    toItem("prod-festive-instagram-kit", "personal"),
  ].filter((item): item is CartItem => item !== null);
  return withTotals({ ...EMPTY_CART, id: "cart-sample", items });
}

function newCartId(): string {
  cartSeq += 1;
  return `cart-${Date.now().toString(36)}-${cartSeq}`;
}

function cookieOptions(httpOnly: boolean) {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax" as const,
    httpOnly,
    secure: process.env.NODE_ENV === "production",
  };
}

async function readSession(): Promise<{ id: string | null; cart: Cart }> {
  const jar = await cookies();
  const id = jar.get(CART_COOKIE)?.value ?? null;
  if (id && cartStore.has(id)) {
    const stored = cartStore.get(id);
    if (stored) return { id, cart: withTotals(stored) };
  }
  return { id: null, cart: sampleCart() };
}

async function writeSession(cart: Cart, id: string | null): Promise<Cart> {
  const jar = await cookies();
  const cartId = id ?? newCartId();
  const next = withTotals({ ...cart, id: cartId });
  cartStore.set(cartId, next);
  jar.set(CART_COOKIE, cartId, cookieOptions(true));
  jar.set(CART_COUNT_COOKIE, String(next.itemCount), cookieOptions(false));
  return next;
}

function assertLicense(license: string): asserts license is LicenseCode {
  if (!(LICENSE_CODES as string[]).includes(license)) {
    throw new Error(`Unknown license "${license}".`);
  }
}

class MockCartService implements CartService {
  async getCart(): Promise<Cart> {
    return sampleCart();
  }

  async getSessionCart(): Promise<Cart> {
    return (await readSession()).cart;
  }

  async addItem(productId: ID, license: LicenseCode): Promise<Cart> {
    assertLicense(license);
    const item = toItem(productId, license);
    if (!item) {
      throw new Error("This product is unavailable with this license.");
    }
    const { id, cart } = await readSession();
    const items = [
      ...cart.items.filter((entry) => entry.key !== item.key),
      item,
    ];
    return writeSession({ ...cart, items }, id);
  }

  async updateItem(key: string, license: LicenseCode): Promise<Cart> {
    assertLicense(license);
    const { id, cart } = await readSession();
    const current = cart.items.find((entry) => entry.key === key);
    if (!current) throw new Error("Cart item not found.");
    if (current.license === license) return writeSession(cart, id);
    const item = toItem(current.productId, license);
    if (!item) {
      throw new Error("This product is unavailable with this license.");
    }
    // The license change renames the line key; preserve the line position
    // and merge when the target line already exists.
    const position = cart.items.findIndex((entry) => entry.key === key);
    const items = cart.items.filter(
      (entry) => entry.key !== key && entry.key !== item.key,
    );
    items.splice(Math.max(position, 0), 0, item);
    return writeSession({ ...cart, items }, id);
  }

  async removeItem(key: string): Promise<Cart> {
    const { id, cart } = await readSession();
    return writeSession(
      { ...cart, items: cart.items.filter((entry) => entry.key !== key) },
      id,
    );
  }

  async applyCoupon(code: string): Promise<Cart> {
    const normalized = code.trim().toUpperCase();
    if (!MOCK_COUPONS[normalized]) {
      throw new Error(`Coupon "${code.trim()}" is not valid.`);
    }
    const { id, cart } = await readSession();
    return writeSession({ ...cart, couponCode: normalized }, id);
  }

  async removeCoupon(): Promise<Cart> {
    const { id, cart } = await readSession();
    return writeSession({ ...cart, couponCode: undefined }, id);
  }

  async clearCart(): Promise<Cart> {
    const { id } = await readSession();
    return writeSession(
      { ...EMPTY_CART, items: [], couponCode: undefined },
      id,
    );
  }
}

/* ------------------------------ API ------------------------------ */

class ApiCartService implements CartService {
  getCart(): Promise<Cart> {
    return apiFetch<Cart>(apiEndpoints.cart);
  }

  getSessionCart(): Promise<Cart> {
    return this.getCart();
  }

  addItem(productId: ID, license: LicenseCode): Promise<Cart> {
    return apiFetch<Cart>(apiEndpoints.cart, {
      method: "POST",
      body: { productId, license },
    });
  }

  updateItem(key: string, license: LicenseCode): Promise<Cart> {
    return apiFetch<Cart>(apiEndpoints.cart, {
      method: "PATCH",
      body: { key, license },
    });
  }

  removeItem(key: string): Promise<Cart> {
    return apiFetch<Cart>(apiEndpoints.cart, {
      method: "DELETE",
      searchParams: { key },
    });
  }

  applyCoupon(code: string): Promise<Cart> {
    return apiFetch<Cart>(apiEndpoints.cart, {
      method: "POST",
      body: { coupon: code },
    });
  }

  removeCoupon(): Promise<Cart> {
    return apiFetch<Cart>(apiEndpoints.cart, {
      method: "DELETE",
      searchParams: { coupon: true },
    });
  }

  clearCart(): Promise<Cart> {
    return apiFetch<Cart>(apiEndpoints.cart, { method: "DELETE" });
  }
}

/* --------------------------- Factory --------------------------- */

let cached: CartService | null = null;

/** Pages, actions and route handlers consume the cart only here. */
export function getCartService(): CartService {
  cached ??=
    process.env.USE_MOCK_API === "false"
      ? new ApiCartService()
      : new MockCartService();
  return cached;
}
