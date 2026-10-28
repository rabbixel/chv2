import { products } from "@/data/products";
import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { cacheTags, REVALIDATE_SECONDS } from "@/lib/cache";
import {
  isLocalWordPressMediaUrl,
  normalizeWordPressMediaUrl,
  productionWordPressHostname,
} from "@/lib/creative-hatti/media";
import {
  selectGalleryImages,
} from "@/lib/creative-hatti/image-matching.mjs";
import {
  apiCategorySlug,
  paginatedFromApi,
  productFromApi,
} from "@/lib/creative-hatti/adapters";
import type {
  ChApiEnvelope,
  ChApiProductCard,
  ChApiProductDetail,
  ChApiProductAvailabilityBatch,
  ChApiSitemapBatch,
  ChWpMedia,
} from "@/lib/creative-hatti/types";
import type {
  Paginated,
  PaginationParams,
  Product,
  ProductImage,
  Slug,
} from "@/lib/types";
import { normalizePaginationParams, paginateItems } from "@/lib/utils";
import { isLiveApiEnabled } from "./apiMode";

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
  getProductById(id: string): Promise<Product | null>;
  getProductBySlug(slug: Slug): Promise<Product | null>;
  /** Fresh product/variation data for server-side cart mutations. */
  getProductForQuickAdd(slug: Slug): Promise<Product | null>;
  listRelatedProducts(slug: Slug, limit?: number): Promise<Product[]>;
  listFeaturedProducts(limit?: number): Promise<Product[]>;
  listBestsellers(limit?: number): Promise<Product[]>;
  listNewArrivals(limit?: number): Promise<Product[]>;
  getSitemapBatch(page: number, pageSize: number): Promise<{
    total: number;
    items: Array<{ slug: string; updatedAt?: string; canonicalUrl?: string }>;
  }>;
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
  async getSitemapBatch(page: number, pageSize: number) {
    const active = products.filter((product) => product.status === "active");
    const start = (page - 1) * pageSize;
    return {
      total: active.length,
      items: active.slice(start, start + pageSize).map((product) => ({
        slug: product.slug,
        updatedAt: product.updatedAt,
        canonicalUrl: product.seo?.canonicalUrl,
      })),
    };
  }

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

  async getProductForQuickAdd(slug: Slug): Promise<Product | null> {
    return this.getProductBySlug(slug);
  }

  async getProductById(id: string): Promise<Product | null> {
    return products.find((product) => product.id === id) ?? null;
  }

  async listRelatedProducts(slug: Slug, limit = 8): Promise<Product[]> {
    const current = products.find((product) => product.slug === slug);
    if (!current) return [];
    const others = products.filter(
      (product) => product.slug !== slug && product.status === "active",
    );
    const primary = current.categorySlugs[0] ?? current.productGroup;
    const sameCategory = others.filter((product) =>
      product.categorySlugs.includes(primary),
    );
    const sameGroup = others.filter(
      (product) =>
        !product.categorySlugs.includes(primary) &&
        product.productGroup === current.productGroup,
    );
    const overlap = (product: Product): number =>
      product.tags.filter((tag) => current.tags.includes(tag)).length;
    const rest = others
      .filter((product) => product.productGroup !== current.productGroup)
      .sort(
        (a, b) => overlap(b) - overlap(a) || b.salesCount - a.salesCount,
      );
    return [...sameCategory, ...sameGroup, ...rest].slice(0, limit);
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
  async getSitemapBatch(page: number, pageSize: number) {
    const result = await apiFetch<ChApiEnvelope<ChApiSitemapBatch>>(
      apiEndpoints.products.sitemap,
      {
        searchParams: { page, per_page: pageSize },
        revalidate: REVALIDATE_SECONDS.catalog,
        tags: [cacheTags.products],
      },
    );
    return {
      total: result.data.total,
      items: result.data.items.map((item) => ({
        slug: item.slug,
        updatedAt: item.modified,
        canonicalUrl: item.canonical_url ?? undefined,
      })),
    };
  }

  async listProducts(params: ProductListParams = {}): Promise<Paginated<Product>> {
    const { page, pageSize } = normalizePaginationParams(params);
    const result = await apiFetch<ChApiEnvelope<ChApiProductCard[]>>(
      apiEndpoints.products.list,
      {
        searchParams: {
          page,
          per_page: pageSize,
          category: params.categorySlug
            ? apiCategorySlug(params.categorySlug)
            : undefined,
          featured: params.featured,
          orderby: params.sort === "oldest" ? "date" : undefined,
          order: params.sort === "oldest" ? "asc" : "desc",
        },
        revalidate: REVALIDATE_SECONDS.catalog,
        tags: [cacheTags.products],
      },
    );
    const paginated = paginatedFromApi(result, productFromApi);
    return { ...paginated, items: await refreshProductAvailability(paginated.items) };
  }

  async getProductBySlug(slug: Slug): Promise<Product | null> {
    try {
      const result = await apiFetch<ChApiEnvelope<ChApiProductDetail>>(
        apiEndpoints.products.detail(slug),
        {
          revalidate: REVALIDATE_SECONDS.product,
          tags: [cacheTags.product(slug)],
        },
      );
      const product = await refreshProductAvailability([productFromApi(result.data)]).then((items) => items[0]);
      const enrichedImages = await mapWithConcurrency(product.images, 4, (image) =>
        enrichImageMetadata(image),
      );
      const selected = await selectGalleryImages(enrichedImages, loadImageForComparison);
      return { ...product, images: selected.images };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  async getProductForQuickAdd(slug: Slug): Promise<Product | null> {
    try {
      const result = await apiFetch<ChApiEnvelope<ChApiProductDetail>>(
        apiEndpoints.products.detail(slug),
        { cache: "no-store", redirect: "error", timeoutMs: 10_000 },
      );
      return productFromApi(result.data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  async getProductById(id: string): Promise<Product | null> {
    if (!/^[1-9][0-9]{0,9}$/.test(id)) return null;
    try {
      const result = await apiFetch<ChApiEnvelope<ChApiProductDetail>>(
        apiEndpoints.products.byId(id),
        {
          revalidate: REVALIDATE_SECONDS.product,
          tags: [cacheTags.product(id)],
        },
      );
      const product = await refreshProductAvailability([productFromApi(result.data)]).then((items) => items[0]);
      const enrichedImages = await mapWithConcurrency(product.images, 4, (image) =>
        enrichImageMetadata(image),
      );
      const selected = await selectGalleryImages(enrichedImages, loadImageForComparison);
      return { ...product, images: selected.images };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  async listRelatedProducts(slug: Slug, limit = 8): Promise<Product[]> {
    const current = await this.getProductBySlug(slug);
    const categorySlug = current?.categorySlugs[0];
    if (!categorySlug) return [];
    const result = await this.listProducts({
      categorySlug,
      pageSize: limit + 1,
      sort: "newest",
    });
    return result.items
      .filter((product) => product.slug !== slug)
      .slice(0, limit);
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

/** Overlay current purchase state onto cached catalogue records. */
export async function refreshProductAvailability(products: Product[]): Promise<Product[]> {
  if (products.length === 0) return products;
  try {
    const result = await apiFetch<ChApiEnvelope<ChApiProductAvailabilityBatch>>(
      apiEndpoints.products.availability,
      {
        searchParams: { ids: products.map((product) => product.id).join(",") },
        cache: "no-store",
        timeoutMs: 8_000,
      },
    );
    const states = new Map(result.data.items.map((item) => [String(item.id), item]));
    return products.map((product) => {
      const state = states.get(String(product.id));
      return state
        ? { ...product, soldOut: state.sold_out, purchasable: product.priceValid !== false && state.available }
        : { ...product, soldOut: false, purchasable: false };
    });
  } catch {
    // When current state cannot be checked, fail closed in the UI. Checkout
    // still performs the authoritative server-side availability validation.
    return products.map((product) => ({ ...product, soldOut: false, purchasable: false }));
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  callback: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await callback(items[index], index);
    }
  }));
  return output;
}

async function enrichImageMetadata(image: ProductImage): Promise<ProductImage> {
  try {
    const media = await apiFetch<ChWpMedia>(apiEndpoints.wordpress.mediaDetail(Number(image.id)), {
      wordpress: true,
      revalidate: REVALIDATE_SECONDS.product,
      tags: [cacheTags.products],
      timeoutMs: 8_000,
    });
    const details = media.media_details;
    const file = details?.file?.replaceAll("\\", "/");
    const originalFile = details?.original_image;
    let sourceFile = file;
    let originalUrl = media.source_url;
    if (file && originalFile) {
      const directory = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "";
      sourceFile = [directory, originalFile].filter(Boolean).join("/");
      const parsed = new URL(media.source_url);
      const parentPath = parsed.pathname.slice(0, parsed.pathname.lastIndexOf("/"));
      parsed.pathname = `${parentPath}/${originalFile.split("/").map(encodeURIComponent).join("/")}`;
      originalUrl = parsed.toString();
    }
    return {
      ...image,
      url: normalizeWordPressMediaUrl(originalUrl || image.url),
      originalUrl: normalizeWordPressMediaUrl(originalUrl || image.url),
      sourceFile: sourceFile ?? image.sourceFile,
      originalFile: originalFile ?? image.originalFile,
      parentId: media.post === null || media.post === undefined
        ? image.parentId
        : String(media.post),
      width: image.width ?? details?.width,
      height: image.height ?? details?.height,
    };
  } catch {
    return image;
  }
}

async function loadImageForComparison(image: ProductImage): Promise<Uint8Array | null> {
  const candidates = [image.originalUrl, image.url].filter((url): url is string => Boolean(url));
  try {
    const localUrl = new URL(image.url);
    if (isLocalWordPressMediaUrl(image.url)) {
      candidates.push(new URL(`${localUrl.pathname}${localUrl.search}`, `https://${productionWordPressHostname()}`).toString());
    }
  } catch {
    return null;
  }

  for (const url of [...new Set(candidates)]) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8_000),
        next: { revalidate: REVALIDATE_SECONDS.product },
      });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) continue;
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > 24 * 1024 * 1024) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength <= 24 * 1024 * 1024) return bytes;
    } catch {
      // Try the production media URL when a local copy is missing or unreadable.
    }
  }
  return null;
}

/* --------------------------- Factory --------------------------- */

let cached: ProductService | null = null;

/** Pages and components consume products only through this accessor. */
export function getProductService(): ProductService {
  cached ??=
    isLiveApiEnabled()
      ? new ApiProductService()
      : new MockProductService();
  return cached;
}

/** Resolve account purchase artwork through the same product service as cart. */
export async function resolveProductImagesByUrl(
  productUrls: readonly (string | null)[],
): Promise<Map<string, ProductImage>> {
  const urlToSlug = new Map<string, string>();
  for (const value of productUrls) {
    if (!value) continue;
    const match = value.match(/^\/product\/([^/?#]+)\/?$/);
    if (!match) continue;
    try {
      const slug = decodeURIComponent(match[1]);
      if (/^[\w-]+$/.test(slug)) urlToSlug.set(value, slug);
    } catch {
      // Ignore malformed product links and let the page use its API fallback.
    }
  }

  const productBySlug = new Map<string, Product>();
  await Promise.all(
    [...new Set(urlToSlug.values())].map(async (slug) => {
      try {
        const product = await getProductService().getProductBySlug(slug);
        if (product) productBySlug.set(slug, product);
      } catch {
        // The purchase snapshot and its full-size API image remain available.
      }
    }),
  );

  const imageByUrl = new Map<string, ProductImage>();
  for (const [url, slug] of urlToSlug) {
    const image = productBySlug.get(slug)?.images.find((candidate) => Boolean(candidate.url));
    if (image) imageByUrl.set(url, image);
  }
  return imageByUrl;
}
