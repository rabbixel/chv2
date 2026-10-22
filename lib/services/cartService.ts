import { cookies } from "next/headers";
import { licenses } from "@/data/licenses";
import { products } from "@/data/products";
import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { CART_COOKIE, CART_COUNT_COOKIE } from "@/lib/constants";
import { getWordPressBridgeHeaders, getWordPressOptionalSessionBridgeHeaders } from "./authService";
import { isLiveApiEnabled } from "./apiMode";
import { decodeHtmlEntities } from "@/lib/creative-hatti/html";
import { addCartLineOnce, sameCartLine } from "./cartLine";
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
  addItem(productId: ID, license: LicenseCode, priceId?: number | null): Promise<Cart>;
  updateItem(key: string, license: LicenseCode, priceId?: number): Promise<Cart>;
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
  private async rawItems(): Promise<Array<{ product_id: number; price_id: number | null; quantity: number }>> {
    const raw = (await cookies()).get(CART_COOKIE)?.value;
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const rows = parsed.slice(0, 40).flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const row = entry as Record<string, unknown>;
        const productId = Number(row.product_id);
        const priceId = row.price_id === null ? null : Number(row.price_id);
        const quantity = Number(row.quantity);
        return Number.isSafeInteger(productId) && productId > 0 &&
          (priceId === null || (Number.isSafeInteger(priceId) && priceId >= 0)) &&
          Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 10
          ? [{ product_id: productId, price_id: priceId, quantity }]
          : [];
      });
      const unique = new Map<string, { product_id: number; price_id: number | null; quantity: number }>();
      for (const row of rows) {
        const key = `${row.product_id}:${row.price_id ?? "base"}`;
        const current = unique.get(key);
        if (current) current.quantity = Math.min(10, current.quantity + row.quantity);
        else unique.set(key, row);
      }
      return Array.from(unique.values()).slice(0, 20);
    } catch { return []; }
  }

  private async validate(items: Array<{ product_id: number; price_id: number | null; quantity: number }>): Promise<Cart> {
    const headers = await getWordPressOptionalSessionBridgeHeaders();
    const options = { method: "POST" as const, body: { items }, cache: "no-store" as const, redirect: "error" as const };
    let envelope: { data: { currency: string; items: Array<Record<string, unknown>>; subtotal: number; item_count: number } };
    try {
      envelope = await apiFetch(apiEndpoints.cart, { ...options, headers });
    } catch (error) {
      // Cart validation is guest-safe. If an expired optional session is rejected,
      // retry only this public cart request without user identity.
      if (!(error instanceof ApiError && error.status === 401 && error.code === "invalid_session" && headers.Authorization)) throw error;
      envelope = await apiFetch(apiEndpoints.cart, { ...options, headers: getWordPressBridgeHeaders() });
    }
    const currency = envelope.data.currency || "INR";
    const mapped: CartItem[] = envelope.data.items.map((row) => {
      const id = Number(row.product_id);
      const priceId = row.price_id === null ? null : Number(row.price_id);
      const amount = Number(row.unit_price ?? 0);
      const quantity = Number(row.quantity ?? 1);
      return {
        key: `${id}:${priceId ?? "base"}`, productId: String(id),
        productSlug: String(row.slug ?? "unavailable"), title: decodeHtmlEntities(String(row.title ?? "Product unavailable")),
        ...(typeof row.thumbnail === "string" && row.thumbnail ? { thumbnailUrl: row.thumbnail } : {}),
        priceId, optionName: String(row.option_name ?? ""),
        available: Boolean(row.available),
        ...(typeof row.message === "string" ? { availabilityMessage: row.message } : {}),
        priceOptions: Array.isArray(row.price_options) ? row.price_options.map((option) => {
          const value = option as Record<string, unknown>;
          return { id: Number(value.id), name: decodeHtmlEntities(String(value.name ?? "")), price: { amount: Number(value.amount ?? 0), currency } };
        }) : [],
        license: "personal", quantity,
        unitPrice: { amount, currency },
        lineTotal: { amount: Number(row.line_total ?? amount * quantity), currency },
      };
    });
    const subtotal = Number(envelope.data.subtotal ?? 0);
    return { id: "cart-session", currency, items: mapped, itemCount: Number(envelope.data.item_count ?? mapped.reduce((n, i) => n + i.quantity, 0)), subtotal: { amount: subtotal, currency }, total: { amount: subtotal, currency }, updatedAt: new Date().toISOString() };
  }

  private async save(
    items: Array<{ product_id: number; price_id: number | null; quantity: number }>,
    requireAvailable?: { productId: number; priceId: number | null },
  ): Promise<Cart> {
    if (items.length > 20) throw new Error("Your cart can contain up to 20 products.");
    const cart = await this.validate(items);
    if (requireAvailable) {
      const selected = cart.items.find((item) =>
        Number(item.productId) === requireAvailable.productId &&
        item.priceId === requireAvailable.priceId,
      );
      if (!selected?.available) {
        throw new Error(selected?.availabilityMessage || "This product option is unavailable.");
      }
    }
    const persisted = cart.items.map((item) => ({ product_id: Number(item.productId), price_id: item.priceId ?? null, quantity: item.quantity }));
    const jar = await cookies();
    const options = { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" as const, httpOnly: true, secure: process.env.NODE_ENV === "production" };
    jar.set(CART_COOKIE, JSON.stringify(persisted), options);
    jar.set(CART_COUNT_COOKIE, String(cart.itemCount), { ...options, httpOnly: false });
    return cart;
  }

  async getCart(): Promise<Cart> { return { ...EMPTY_CART, id: "cart-live", items: [] }; }
  async getSessionCart(): Promise<Cart> { return this.validate(await this.rawItems()); }

  async addItem(productId: ID, _license: LicenseCode, priceId: number | null = null): Promise<Cart> {
    const id = Number(productId);
    if (!Number.isSafeInteger(id) || id <= 0 || (priceId !== null && (!Number.isSafeInteger(priceId) || priceId < 0))) throw new Error("Invalid product option.");
    const items = await this.rawItems();
    const line = { product_id: id, price_id: priceId, quantity: 1 };
    const existing = items.some((entry) => sameCartLine(entry, line));
    if (!existing && items.length >= 20) throw new Error("Your cart can contain up to 20 products.");
    const result = addCartLineOnce(items, line);
    return this.save(result.lines, { productId: id, priceId });
  }

  async updateItem(key: string, license: LicenseCode, priceId?: number): Promise<Cart> {
    const row = (await this.getSessionCart()).items.find((item) => item.key === key);
    if (!row) throw new Error("Cart item not found.");
    const id = Number(row.productId);
    if (row.priceOptions?.length) return this.updatePrice(key, priceId ?? row.priceId ?? null);
    return this.save(
      (await this.rawItems()).map((entry) => entry.product_id === id ? { ...entry, price_id: null } : entry),
      { productId: id, priceId: null },
    );
  }

  private async updatePrice(key: string, priceId: number | null): Promise<Cart> {
    const items = await this.rawItems();
    const cart = await this.getSessionCart();
    const current = cart.items.find((item) => item.key === key);
    if (!current) throw new Error("Cart item not found.");
    const id = Number(current.productId);
    const item = items.find((entry) => entry.product_id === id && entry.price_id === current.priceId);
    if (!item) throw new Error("Cart item not found.");
    item.price_id = priceId;
    return this.save(items, { productId: id, priceId });
  }

  async removeItem(key: string): Promise<Cart> {
    const cart = await this.getSessionCart();
    const target = cart.items.find((item) => item.key === key);
    if (!target) return cart;
    const id = Number(target.productId);
    return this.save((await this.rawItems()).filter((entry) => !(entry.product_id === id && entry.price_id === target.priceId)));
  }

  applyCoupon(code: string): Promise<Cart> {
    throw new Error(`Coupon "${code}" is not available in this cart.`);
  }

  removeCoupon(): Promise<Cart> {
    return this.getSessionCart();
  }

  clearCart(): Promise<Cart> {
    return this.save([]);
  }
}

/* --------------------------- Factory --------------------------- */

let cached: CartService | null = null;

/** Pages, actions and route handlers consume the cart only here. */
export function getCartService(): CartService {
  cached ??=
    isLiveApiEnabled()
      ? new ApiCartService()
      : new MockCartService();
  return cached;
}
