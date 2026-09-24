import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { ID, Wishlist } from "@/lib/types";

export interface WishlistService {
  getWishlist(): Promise<Wishlist>;
  addItem(productId: ID): Promise<Wishlist>;
  removeItem(productId: ID): Promise<Wishlist>;
}

const SAMPLE_PRODUCT_IDS: ID[] = ["prod-001", "prod-013", "prod-021"];

/** Mock wishlist: stable sample reads, non-persisting mutations (see cart). */
class MockWishlistService implements WishlistService {
  private sample(): Wishlist {
    return {
      id: "wishlist-guest",
      customerId: "customer-guest",
      items: SAMPLE_PRODUCT_IDS.map((productId) => ({
        productId,
        addedAt: new Date(0).toISOString(),
      })),
      updatedAt: new Date(0).toISOString(),
    };
  }

  async getWishlist(): Promise<Wishlist> {
    return this.sample();
  }

  async addItem(productId: ID): Promise<Wishlist> {
    const current = this.sample();
    if (current.items.some((item) => item.productId === productId)) {
      return current;
    }
    return {
      ...current,
      items: [...current.items, { productId, addedAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    };
  }

  async removeItem(productId: ID): Promise<Wishlist> {
    const current = this.sample();
    return {
      ...current,
      items: current.items.filter((item) => item.productId !== productId),
      updatedAt: new Date().toISOString(),
    };
  }
}

class ApiWishlistService implements WishlistService {
  getWishlist(): Promise<Wishlist> {
    return apiFetch<Wishlist>(apiEndpoints.wishlist);
  }

  addItem(productId: ID): Promise<Wishlist> {
    return apiFetch<Wishlist>(apiEndpoints.wishlist, {
      method: "POST",
      body: { productId },
    });
  }

  removeItem(productId: ID): Promise<Wishlist> {
    return apiFetch<Wishlist>(apiEndpoints.wishlist, {
      method: "DELETE",
      body: { productId },
    });
  }
}

let cached: WishlistService | null = null;

export function getWishlistService(): WishlistService {
  cached ??=
    process.env.USE_MOCK_API === "false"
      ? new ApiWishlistService()
      : new MockWishlistService();
  return cached;
}
