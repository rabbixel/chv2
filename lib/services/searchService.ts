import { products } from "@/data/products";
import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { cacheTags, REVALIDATE_SECONDS } from "@/lib/cache";
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

function matchesQuery(product: Product, query: string): boolean {
  const haystack =
    `${product.title} ${product.tags.join(" ")} ${product.categorySlugs.join(" ")} ${product.fileTypes.join(" ")}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function applyFilters(
  items: Product[],
  filters: SearchFilters = {},
): Product[] {
  return items.filter((product) => {
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
    case "price-asc":
      return sorted.sort((a, b) => a.price.amount - b.price.amount);
    case "price-desc":
      return sorted.sort((a, b) => b.price.amount - a.price.amount);
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
  const countBy = (pick: (product: Product) => string[]) => {
    const counts = new Map<string, number>();
    for (const product of items) {
      for (const value of pick(product)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([value, count]) => ({
        value,
        label: value,
        count,
      }));
  };
  return [
    { key: "category", label: "Category", values: countBy((p) => p.categorySlugs) },
    { key: "fileType", label: "File type", values: countBy((p) => p.fileTypes) },
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
  searchProducts(params: SearchParams): Promise<SearchResult<Product>> {
    const { page, pageSize } = normalizePaginationParams(params);
    return apiFetch<SearchResult<Product>>(apiEndpoints.search, {
      searchParams: {
        q: params.query,
        page,
        pageSize,
        sort: params.sort,
      },
      revalidate: REVALIDATE_SECONDS.search,
      tags: [cacheTags.search],
    });
  }
}

let cached: SearchService | null = null;

export function getSearchService(): SearchService {
  cached ??=
    process.env.USE_MOCK_API === "false"
      ? new ApiSearchService()
      : new MockSearchService();
  return cached;
}
