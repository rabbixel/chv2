import { cookies } from "next/headers";
import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { WISHLIST_COOKIE, WISHLIST_COUNT_COOKIE } from "@/lib/constants";
import { normalizeWishlist, setWishlistItem, shouldSeedDemoWishlist } from "@/lib/creative-hatti/wishlist";
import type { ID, Wishlist } from "@/lib/types";

export interface WishlistService {
  getWishlist(): Promise<Wishlist>;
  addItem(productId: ID): Promise<Wishlist>;
  removeItem(productId: ID): Promise<Wishlist>;
}

/* ------------------------------ Mock ------------------------------ */

/** Scaffold seeding for visitors without a wishlist yet (real products). */
const SEED_PRODUCT_IDS: ID[] = [
  "prod-hanuman-character-bundle",
  "prod-indian-wedding-invitation",
  "prod-desi-truck-art",
];

const wishlistStore = new Map<string, Wishlist>();
let wishlistSeq = 0;

function seedWishlist(): Wishlist {
  return {
    id: "wishlist-seed",
    customerId: "customer-guest",
    items: SEED_PRODUCT_IDS.map((productId, index) => ({
      productId,
      addedAt: new Date(Date.UTC(2026, 8, 20 + index, 10, 0, 0)).toISOString(),
    })),
    updatedAt: new Date(0).toISOString(),
  };
}

function emptyWishlist(): Wishlist {
  return {
    id: "wishlist-empty",
    customerId: "customer-session",
    items: [],
    updatedAt: new Date(0).toISOString(),
  };
}

async function readSession(): Promise<{ id: string | null; wishlist: Wishlist }> {
  const jar = await cookies();
  const id = jar.get(WISHLIST_COOKIE)?.value ?? null;
  if (id && wishlistStore.has(id)) {
    const stored = wishlistStore.get(id);
    if (stored) return { id, wishlist: stored };
  }
  // Demo seed IDs belong to the mock catalogue. Never present them as an
  // authenticated WordPress customer's saved products.
  const wishlist = shouldSeedDemoWishlist(process.env.CH_AUTH_MODE)
    ? seedWishlist()
    : emptyWishlist();
  return { id: null, wishlist };
}

async function writeSession(wishlist: Wishlist, id: string | null): Promise<Wishlist> {
  const jar = await cookies();
  wishlistSeq += 1;
  const wishlistId = id ?? `wishlist-${Date.now().toString(36)}-${wishlistSeq}`;
  const next: Wishlist = {
    ...wishlist,
    id: wishlistId,
    updatedAt: new Date().toISOString(),
  };
  wishlistStore.set(wishlistId, next);
  jar.set(WISHLIST_COOKIE, wishlistId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  jar.set(WISHLIST_COUNT_COOKIE, String(next.items.length), {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return next;
}

async function writeCountMirror(wishlist: Wishlist): Promise<void> {
  const jar = await cookies();
  jar.set(WISHLIST_COUNT_COOKIE, String(wishlist.items.length), {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

/** Mock wishlist: cookie-session store seeded with real products. */
class MockWishlistService implements WishlistService {
  async getWishlist(): Promise<Wishlist> {
    return (await readSession()).wishlist;
  }

  async addItem(productId: ID): Promise<Wishlist> {
    const { id, wishlist } = await readSession();
    const items = setWishlistItem(wishlist.items, productId, true, new Date().toISOString());
    if (items.length === wishlist.items.length) {
      return wishlist;
    }
    return writeSession(
      { ...wishlist, items },
      id,
    );
  }

  async removeItem(productId: ID): Promise<Wishlist> {
    const { id, wishlist } = await readSession();
    return writeSession(
      {
        ...wishlist,
        items: setWishlistItem(wishlist.items, productId, false, ""),
      },
      id,
    );
  }
}

class ApiWishlistService implements WishlistService {
  async getWishlist(): Promise<Wishlist> {
    return normalizeWishlist(await apiFetch<Wishlist>(apiEndpoints.wishlist));
  }

  async addItem(productId: ID): Promise<Wishlist> {
    const wishlist = normalizeWishlist(await apiFetch<Wishlist>(apiEndpoints.wishlist, {
      method: "POST",
      body: { productId },
    }));
    await writeCountMirror(wishlist);
    return wishlist;
  }

  async removeItem(productId: ID): Promise<Wishlist> {
    const wishlist = normalizeWishlist(await apiFetch<Wishlist>(apiEndpoints.wishlist, {
      method: "DELETE",
      body: { productId },
    }));
    await writeCountMirror(wishlist);
    return wishlist;
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
