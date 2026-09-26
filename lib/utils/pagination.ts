import { PAGINATION } from "@/lib/constants";
import type { Pagination, PaginationParams } from "@/lib/types";

/** Normalise raw page/pageSize input into safe integers. */
export function normalizePaginationParams(
  params: PaginationParams | undefined,
  fallbackPageSize: number = PAGINATION.defaultPageSize,
): { page: number; pageSize: number } {
  const page =
    params?.page && Number.isFinite(params.page)
      ? Math.max(1, Math.floor(params.page))
      : 1;
  const requested = params?.pageSize ?? fallbackPageSize;
  const pageSize = Number.isFinite(requested)
    ? Math.min(PAGINATION.maxPageSize, Math.max(1, Math.floor(requested)))
    : fallbackPageSize;
  return { page, pageSize };
}

/** Build a `Pagination` object from a total count. */
export function buildPagination(
  totalItems: number,
  page: number,
  pageSize: number,
): Pagination {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  };
}

/** Slice helper for in-memory (mock) collections. */
export function paginateItems<TItem>(
  items: readonly TItem[],
  page: number,
  pageSize: number,
): { items: TItem[]; pagination: Pagination } {
  const pagination = buildPagination(items.length, page, pageSize);
  const start = (pagination.page - 1) * pagination.pageSize;
  return {
    items: items.slice(start, start + pagination.pageSize),
    pagination,
  };
}

/**
 * Page numbers to render, e.g. page 5 of 12 with siblingCount 1 →
 * `[1, "…", 4, 5, 6, "…", 12]`.
 */
export function getPageWindow(
  page: number,
  totalPages: number,
  siblingCount: number = PAGINATION.siblingCount,
): Array<number | "…"> {
  if (totalPages <= 1) return [1];
  const pages = new Set<number>([1, totalPages, page]);
  for (let i = 1; i <= siblingCount; i += 1) {
    if (page - i > 1) pages.add(page - i);
    if (page + i < totalPages) pages.add(page + i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const window: Array<number | "…"> = [];
  let previous = 0;
  for (const value of sorted) {
    if (value - previous > 1) window.push("…");
    window.push(value);
    previous = value;
  }
  return window;
}
