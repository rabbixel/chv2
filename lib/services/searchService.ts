import { collections } from "@/data/collections";
import { products } from "@/data/products";
import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { cacheTags, REVALIDATE_SECONDS } from "@/lib/cache";
import {
  apiCategorySlug,
  categoryFromApi,
  facetValuesFromCategories,
  paginatedFromApi,
  productFromApi,
} from "@/lib/creative-hatti/adapters";
import type {
  ChApiCategory,
  ChApiEnvelope,
  ChApiProductCard,
} from "@/lib/creative-hatti/types";
import type {
  Product,
  SearchFacet,
  SearchFilters,
  SearchParams,
  SearchResult,
  SearchSortKey,
} from "@/lib/types";
import { normalizePaginationParams, paginateItems } from "@/lib/utils";

export interface SearchService {
  searchProducts(params: SearchParams): Promise<SearchResult<Product>>;
}

/**
 * Keyword-oriented matching like the live Creative Hatti search: every query
 * token must appear somewhere in the title, keywords, tags, categories,
 * product group or file types. An empty query matches the whole catalogue
 * (browse mode).
 */
function matchesQuery(product: Product, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack =
    `${product.title} ${product.keywords.join(" ")} ${product.tags.join(" ")} ${product.categorySlugs.join(" ")} ${product.productGroup} ${product.fileTypes.join(" ")}`.toLowerCase();
  if (tokens.every((token) => haystack.includes(token))) return true;
  // Collection-aware: a query naming a collection ("diwali", "logo
  // templates") also matches every product in that collection.
  return collections.some((collection) => {
    const title = collection.title.toLowerCase();
    const queryText = query.toLowerCase().trim();
    if (!title.includes(queryText) && !queryText.includes(title)) return false;
    return matchesCollectionQuery(product, collection.query);
  });
}

function matchesCollectionQuery(product: Product, collectionQuery: string): boolean {
  const haystack =
    `${product.title} ${product.keywords.join(" ")} ${product.tags.join(" ")} ${product.categorySlugs.join(" ")}`.toLowerCase();
  return collectionQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function applyFilters(
  items: Product[],
  filters: SearchFilters = {},
): Product[] {
  const collection = filters.collection
    ? collections.find((entry) => entry.slug === filters.collection)
    : undefined;
  return items.filter((product) => {
    if (
      filters.groups?.length &&
      !filters.groups.includes(product.productGroup)
    ) {
      return false;
    }
    if (
      filters.categorySlugs?.length &&
      !filters.categorySlugs.some((slug) => product.categorySlugs.includes(slug))
    ) {
      return false;
    }
    if (
      filters.priceMin !== undefined &&
      product.price.amount < filters.priceMin
    ) {
      return false;
    }
    if (
      filters.priceMax !== undefined &&
      product.price.amount > filters.priceMax
    ) {
      return false;
    }
    if (filters.availability === "free" && !product.isFree) return false;
    if (filters.availability === "paid" && product.isFree) return false;
    if (
      filters.ratingMin !== undefined &&
      product.ratingAverage < filters.ratingMin
    ) {
      return false;
    }
    if (
      filters.fileTypes?.length &&
      !filters.fileTypes.some((type) => product.fileTypes.includes(type))
    ) {
      return false;
    }
    if (filters.compatibleWith?.length) {
      const apps = product.compatibleWith.map((entry) => entry.toLowerCase());
      if (
        !filters.compatibleWith.some((app) =>
          apps.some((entry) => entry.includes(app.toLowerCase())),
        )
      ) {
        return false;
      }
    }
    if (
      collection &&
      !matchesCollectionQuery(product, collection.query)
    ) {
      return false;
    }
    if (
      filters.licenses?.length &&
      !filters.licenses.some((licence) => product.licenses.includes(licence))
    ) {
      return false;
    }
    if (filters.onSale && product.compareAtPrice === undefined) return false;
    return true;
  });
}

function sortResults(items: Product[], sort: SearchSortKey): Product[] {
  const sorted = [...items];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "oldest":
      return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "price-asc":
      return sorted.sort((a, b) => a.price.amount - b.price.amount);
    case "price-desc":
      return sorted.sort((a, b) => b.price.amount - a.price.amount);
    case "title-asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "title-desc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case "rating":
      return sorted.sort((a, b) => b.ratingAverage - a.ratingAverage);
    case "best-selling":
      return sorted.sort((a, b) => b.salesCount - a.salesCount);
    case "relevance":
    default:
      // Mock relevance: sales-weighted. The real search index owns ranking.
      return sorted.sort((a, b) => b.salesCount - a.salesCount);
  }
}

function buildFacets(items: Product[]): SearchFacet[] {
  const countBy = (pick: (product: Product) => string[], limit?: number) => {
    const counts = new Map<string, number>();
    for (const product of items) {
      for (const value of pick(product)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value, count]) => ({
        value,
        label: value,
        count,
      }));
  };
  return [
    {
      key: "category",
      label: "Category",
      values: countBy((p) => p.categorySlugs),
    },
    { key: "fileType", label: "File type", values: countBy((p) => p.fileTypes, 16) },
  ];
}

class MockSearchService implements SearchService {
  async searchProducts(params: SearchParams): Promise<SearchResult<Product>> {
    const startedAt = Date.now();
    const { page, pageSize } = normalizePaginationParams(params);
    const sort: SearchSortKey = params.sort ?? "relevance";
    const filters: SearchFilters = params.filters ?? {};

    const matched = sortResults(
      applyFilters(
        products.filter((product) => matchesQuery(product, params.query)),
        filters,
      ),
      sort,
    );
    const facets = buildFacets(matched);
    const { items, pagination } = paginateItems(matched, page, pageSize);

    return {
      items,
      pagination,
      query: params.query,
      sort,
      appliedFilters: filters,
      facets,
      tookMs: Date.now() - startedAt,
    };
  }
}

class ApiSearchService implements SearchService {
  async searchProducts(params: SearchParams): Promise<SearchResult<Product>> {
    const { page, pageSize } = normalizePaginationParams(params);
    const filters = params.filters ?? {};
    const category = filters.categorySlugs?.[0] ?? filters.groups?.[0];
    const free =
      filters.availability === "free"
        ? true
        : filters.groups?.includes("freebies")
          ? true
          : undefined;

    const [result, categoryResult] = await Promise.all([
      apiFetch<ChApiEnvelope<ChApiProductCard[]>>(apiEndpoints.products.list, {
        searchParams: {
          page,
          per_page: pageSize,
          category: category ? apiCategorySlug(category) : undefined,
          free,
          orderby:
            params.sort === "oldest" || params.sort === "newest"
              ? "date"
              : undefined,
          order: params.sort === "oldest" ? "asc" : "desc",
        },
        revalidate: REVALIDATE_SECONDS.search,
        tags: [cacheTags.search],
      }),
      apiFetch<ChApiEnvelope<ChApiCategory[]>>(
        apiEndpoints.categories.list,
        {
          revalidate: REVALIDATE_SECONDS.catalog,
          tags: [cacheTags.categories],
        },
      ),
    ]);
    const paginated = paginatedFromApi(result, productFromApi);
    const categories = categoryResult.data.map(categoryFromApi);

    return {
      items: paginated.items,
      pagination: paginated.pagination,
      query: params.query,
      sort: params.sort ?? "relevance",
      appliedFilters: filters,
      facets: [
        {
          key: "category",
          label: "Category",
          values: facetValuesFromCategories(categories),
        },
        { key: "fileType", label: "File type", values: [] },
      ],
    };
  }
}

let cached: SearchService | null = null;

export function getSearchService(): SearchService {
  cached ??=
    process.env.USE_MOCK_API !== "true" && process.env.CH_API_URL
      ? new ApiSearchService()
      : new MockSearchService();
  return cached;
}
