import { products } from "@/data/products";
import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { cacheTags, REVALIDATE_SECONDS } from "@/lib/cache";
import type {
  Paginated,
  PaginationParams,
  Product,
  Slug,
} from "@/lib/types";
import { normalizePaginationParams, paginateItems } from "@/lib/utils";

export type ProductSortKey =
  | "newest"
  | "oldest"
  | "price-asc"
  | "price-desc"
  | "title-asc"
  | "title-desc"
  | "rating"
  | "best-selling";

export interface ProductListParams extends PaginationParams {
  categorySlug?: Slug;
  tag?: string;
  onSale?: boolean;
  featured?: boolean;
  sort?: ProductSortKey;
}

export interface ProductService {
  listProducts(params?: ProductListParams): Promise<Paginated<Product>>;
  getProductBySlug(slug: Slug): Promise<Product | null>;
  listFeaturedProducts(limit?: number): Promise<Product[]>;
  listBestsellers(limit?: number): Promise<Product[]>;
  listNewArrivals(limit?: number): Promise<Product[]>;
}

/* ------------------------------ Mock ------------------------------ */

const SORT_FNS: Record<ProductSortKey, (a: Product, b: Product) => number> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
  "price-asc": (a, b) => a.price.amount - b.price.amount,
  "price-desc": (a, b) => b.price.amount - a.price.amount,
  "title-asc": (a, b) => a.title.localeCompare(b.title),
  "title-desc": (a, b) => b.title.localeCompare(a.title),
  rating: (a, b) =>
    b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount,
  "best-selling": (a, b) => b.salesCount - a.salesCount,
};

class MockProductService implements ProductService {
  async listProducts(
    params: ProductListParams = {},
  ): Promise<Paginated<Product>> {
    const { page, pageSize } = normalizePaginationParams(params);
    let items = products.filter((product) => product.status === "active");

    if (params.categorySlug) {
      items = items.filter((product) =>
        product.categorySlugs.includes(params.categorySlug as Slug),
      );
    }
    if (params.tag) {
      items = items.filter((product) => product.tags.includes(params.tag as string));
    }
    if (params.onSale) {
      items = items.filter((product) => product.compareAtPrice !== undefined);
    }
    if (params.featured) {
      items = items.filter((product) => product.featured);
    }

    const sort: ProductSortKey = params.sort ?? "best-selling";
    items = [...items].sort(SORT_FNS[sort]);

    return paginateItems(items, page, pageSize);
  }

  async getProductBySlug(slug: Slug): Promise<Product | null> {
    return products.find((product) => product.slug === slug) ?? null;
  }

  async listFeaturedProducts(limit = 8): Promise<Product[]> {
    return products.filter((product) => product.featured).slice(0, limit);
  }

  async listBestsellers(limit = 8): Promise<Product[]> {
    return [...products]
      .sort(SORT_FNS["best-selling"])
      .filter((product) => product.bestseller)
      .slice(0, limit);
  }

  async listNewArrivals(limit = 8): Promise<Product[]> {
    return [...products]
      .sort(SORT_FNS.newest)
      .filter((product) => product.isNew)
      .slice(0, limit);
  }
}

/* ------------------------------ API ------------------------------ */

class ApiProductService implements ProductService {
  listProducts(params: ProductListParams = {}): Promise<Paginated<Product>> {
    const { page, pageSize } = normalizePaginationParams(params);
    return apiFetch<Paginated<Product>>(apiEndpoints.products.list, {
      searchParams: {
        page,
        pageSize,
        category: params.categorySlug,
        tag: params.tag,
        onSale: params.onSale,
        featured: params.featured,
        sort: params.sort,
      },
      revalidate: REVALIDATE_SECONDS.catalog,
      tags: [cacheTags.products],
    });
  }

  async getProductBySlug(slug: Slug): Promise<Product | null> {
    try {
      return await apiFetch<Product>(apiEndpoints.products.detail(slug), {
        revalidate: REVALIDATE_SECONDS.product,
        tags: [cacheTags.product(slug)],
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  async listFeaturedProducts(limit = 8): Promise<Product[]> {
    const result = await this.listProducts({
      featured: true,
      pageSize: limit,
    });
    return result.items;
  }

  async listBestsellers(limit = 8): Promise<Product[]> {
    const result = await this.listProducts({
      sort: "best-selling",
      pageSize: limit,
    });
    return result.items;
  }

  async listNewArrivals(limit = 8): Promise<Product[]> {
    const result = await this.listProducts({ sort: "newest", pageSize: limit });
    return result.items;
  }
}

/* --------------------------- Factory --------------------------- */

let cached: ProductService | null = null;

/** Pages and components consume products only through this accessor. */
export function getProductService(): ProductService {
  cached ??=
    process.env.USE_MOCK_API === "false"
      ? new ApiProductService()
      : new MockProductService();
  return cached;
}
