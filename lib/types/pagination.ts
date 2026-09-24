/** Cursor-free offset pagination shared by every listing endpoint. */

export interface PaginationParams {
  /** 1-based page number. Defaults to 1. */
  page?: number;
  /** Items per page. Defaults to `PAGINATION.defaultPageSize`. */
  pageSize?: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/** Standard envelope for any paginated collection. */
export interface Paginated<TItem> {
  items: TItem[];
  pagination: Pagination;
}
