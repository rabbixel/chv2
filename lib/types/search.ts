import type { Slug } from "./common";
import type { LicenseCode } from "./license";
import type { Paginated, PaginationParams } from "./pagination";

export type SearchSortKey =
  | "relevance"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "best-selling";

export interface SearchFilters {
  categorySlugs?: Slug[];
  /** Minor units (paise). */
  priceMin?: number;
  priceMax?: number;
  ratingMin?: number;
  fileTypes?: string[];
  licenses?: LicenseCode[];
  onSale?: boolean;
}

export interface SearchParams extends PaginationParams {
  query: string;
  filters?: SearchFilters;
  sort?: SearchSortKey;
}

export interface SearchFacetValue {
  value: string;
  label: string;
  count: number;
}

export interface SearchFacet {
  key: string;
  label: string;
  values: SearchFacetValue[];
}

export interface SearchResult<TItem> extends Paginated<TItem> {
  query: string;
  sort: SearchSortKey;
  appliedFilters: SearchFilters;
  facets: SearchFacet[];
  /** Milliseconds the backend/search index took (for diagnostics). */
  tookMs?: number;
}
