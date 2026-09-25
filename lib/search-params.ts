/**
 * Listing URL contract — single place that maps query strings to service
 * input and back. The search page, filter panel, sort control, active-filter
 * chips and pagination all build URLs through `buildListingHref`, so filter
 * state can never desync from the address bar.
 *
 * Params: q, sort, group (multi), cat (multi), min, max (rupees),
 * avail (free|paid), file (multi), app (multi), collection, page.
 */

import type {
  AvailabilityFilter,
  ProductGroupSlug,
  SearchFilters,
  SearchParams,
  SearchSortKey,
  Slug,
} from "@/lib/types";

export interface ListingParams {
  q: string;
  sort: SearchSortKey;
  groups: ProductGroupSlug[];
  cats: Slug[];
  min?: number;
  max?: number;
  avail?: AvailabilityFilter;
  files: string[];
  apps: string[];
  collection?: Slug;
  page: number;
}

export const DEFAULT_LISTING_SORT: SearchSortKey = "relevance";

const GROUP_SLUGS: ProductGroupSlug[] = [
  "vector-creatives",
  "character-bundle",
  "freebies",
];

const SORT_KEYS: SearchSortKey[] = [
  "relevance",
  "newest",
  "oldest",
  "price-asc",
  "price-desc",
  "title-asc",
  "title-desc",
  "rating",
  "best-selling",
];

function asList(
  value: string | string[] | undefined,
): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value])
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function asInt(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function parseListingParams(
  searchParams: Record<string, string | string[] | undefined>,
): ListingParams {
  const rawQuery = searchParams.q;
  const rawSort = (
    Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort
  ) as SearchSortKey | undefined;
  const rawAvail = (
    Array.isArray(searchParams.avail)
      ? searchParams.avail[0]
      : searchParams.avail
  ) as AvailabilityFilter | undefined;
  const rawCollection = searchParams.collection;

  return {
    q: (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim() ?? "",
    sort:
      rawSort && SORT_KEYS.includes(rawSort) ? rawSort : DEFAULT_LISTING_SORT,
    groups: asList(searchParams.group).filter((entry): entry is ProductGroupSlug =>
      (GROUP_SLUGS as string[]).includes(entry),
    ),
    cats: asList(searchParams.cat),
    min: asInt(searchParams.min),
    max: asInt(searchParams.max),
    avail: rawAvail === "free" || rawAvail === "paid" ? rawAvail : undefined,
    files: asList(searchParams.file).map((entry) => entry.toUpperCase()),
    apps: asList(searchParams.app).map((entry) => entry.toLowerCase()),
    collection: (
      Array.isArray(rawCollection) ? rawCollection[0] : rawCollection
    )?.trim() || undefined,
    page: Math.max(1, asInt(searchParams.page) ?? 1),
  };
}

/** Convert listing params to service-layer search input. */
export function toSearchParams(
  params: ListingParams,
  pageSize?: number,
): SearchParams {
  const filters: SearchFilters = {};
  if (params.groups.length > 0) filters.groups = params.groups;
  if (params.cats.length > 0) filters.categorySlugs = params.cats;
  if (params.min !== undefined) filters.priceMin = params.min * 100;
  if (params.max !== undefined) filters.priceMax = params.max * 100;
  if (params.avail) filters.availability = params.avail;
  if (params.files.length > 0) filters.fileTypes = params.files;
  if (params.apps.length > 0) filters.compatibleWith = params.apps;
  if (params.collection) filters.collection = params.collection;

  return {
    query: params.q,
    filters,
    sort: params.sort,
    page: params.page,
    pageSize,
  };
}

export function buildListingHref(
  basePath: string,
  params: ListingParams,
): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.sort !== DEFAULT_LISTING_SORT) search.set("sort", params.sort);
  for (const group of params.groups) search.append("group", group);
  for (const cat of params.cats) search.append("cat", cat);
  if (params.min !== undefined) search.set("min", String(params.min));
  if (params.max !== undefined) search.set("max", String(params.max));
  if (params.avail) search.set("avail", params.avail);
  for (const file of params.files) search.append("file", file);
  for (const app of params.apps) search.append("app", app);
  if (params.collection) search.set("collection", params.collection);
  if (params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Patch helper: `{ ...params, page: 1 }` overrides made easy. */
export function withListingPatch(
  params: ListingParams,
  patch: Partial<ListingParams>,
): ListingParams {
  return { ...params, ...patch, page: patch.page ?? 1 };
}

/** Number of active (non-query, non-sort) filters for badges/buttons. */
export function countActiveFilters(params: ListingParams): number {
  return (
    params.groups.length +
    params.cats.length +
    (params.min !== undefined || params.max !== undefined ? 1 : 0) +
    (params.avail ? 1 : 0) +
    params.files.length +
    params.apps.length +
    (params.collection ? 1 : 0)
  );
}
