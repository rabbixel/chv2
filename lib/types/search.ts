import type { Slug } from "./common";
import type { LicenseCode } from "./license";
import type { ProductGroupSlug } from "./product";
import type { Paginated, PaginationParams } from "./pagination";

/**
 * Listing sort keys, matching the Creative Hatti listing experience:
 * Recent, Popular, Older, price and title orderings.
 */
export type SearchSortKey =
  | "relevance"
  | "newest"
  | "oldest"
  | "price-asc"
  | "price-desc"
  | "title-asc"
  | "title-desc"
  | "rating"
  | "best-selling";

export type AvailabilityFilter = "free" | "paid";

export interface SearchFilters {
  /** Top-level taxonomy groups (OR within the list). */
  groups?: ProductGroupSlug[];
  /** Subcategory slugs (OR within the list). */
  categorySlugs?: Slug[];
  /** Minor units (paise). */
  priceMin?: number;
  priceMax?: number;
  /** Free-only or paid-only. */
  availability?: AvailabilityFilter;
  ratingMin?: number;
  fileTypes?: string[];
  /** Compatible apps, matched case-insensitively, e.g. `["illustrator"]`. */
  compatibleWith?: string[];
  /** Collection slug — constrains results to the collection query. */
  collection?: Slug;
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
