import { products } from "@/data/products";
import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type {
  Cart,
  CartItem,
  ID,
  LicenseCode,
  Slug,
} from "@/lib/types";

export interface CartService {
  getCart(): Promise<Cart>;
  addItem(productId: ID, license: LicenseCode): Promise<Cart>;
  removeItem(key: string): Promise<Cart>;
  clearCart(): Promise<Cart>;
}

const EMPTY_CART: Cart = {
  id: "cart-guest",
  currency: "INR",
  items: [],
  itemCount: 0,
  subtotal: { amount: 0, currency: "INR" },
  updatedAt: new Date(0).toISOString(),
};

function toItem(productId: ID, license: LicenseCode): CartItem | null {
  const product = products.find((item) => item.id === productId);
  if (!product) return null;
  return {
    key: `${product.id}:${license}`,
    productId: product.id,
    productSlug: product.slug as Slug,
    title: product.title,
    license,
    quantity: 1,
    unitPrice: product.price,
    lineTotal: product.price,
  };
}

function withTotals(cart: Cart): Cart {
  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.lineTotal.amount,
    0,
  );
  return {
    ...cart,
    itemCount: cart.items.length,
    subtotal: { amount: subtotal, currency: cart.currency },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Mock cart. Reads return a stable sample cart; mutations return the updated
 * cart WITHOUT persisting (no session store exists in RUN 01). The real
 * implementation will persist via cookie session + backend.
 */
class MockCartService implements CartService {
  private sample(): Cart {
    const items = [
      toItem("prod-004", "commercial"),
      toItem("prod-012", "personal"),
    ].filter((item): item is CartItem => item !== null);
    return withTotals({ ...EMPTY_CART, items });
  }

  async getCart(): Promise<Cart> {
    return this.sample();
  }

  async addItem(productId: ID, license: LicenseCode): Promise<Cart> {
    const item = toItem(productId, license);
    const items = item
      ? [...this.sample().items.filter((entry) => entry.key !== item.key), item]
      : this.sample().items;
    return withTotals({ ...EMPTY_CART, items });
  }

  async removeItem(key: string): Promise<Cart> {
    const items = this.sample().items.filter((item) => item.key !== key);
    return withTotals({ ...EMPTY_CART, items });
  }

  async clearCart(): Promise<Cart> {
    return withTotals({ ...EMPTY_CART });
  }
}

class ApiCartService implements CartService {
  getCart(): Promise<Cart> {
    return apiFetch<Cart>(apiEndpoints.cart);
  }

  addItem(productId: ID, license: LicenseCode): Promise<Cart> {
    return apiFetch<Cart>(apiEndpoints.cart, {
      method: "POST",
      body: { productId, license, quantity: 1 },
    });
  }

  removeItem(key: string): Promise<Cart> {
    return apiFetch<Cart>(apiEndpoints.cart, {
      method: "DELETE",
      body: { key },
    });
  }

  clearCart(): Promise<Cart> {
    return apiFetch<Cart>(apiEndpoints.cart, { method: "DELETE" });
  }
}

let cached: CartService | null = null;

export function getCartService(): CartService {
  cached ??=
    process.env.USE_MOCK_API === "false"
      ? new ApiCartService()
      : new MockCartService();
  return cached;
}
