export type PaginationWindowItem =
  | { type: "page"; page: number }
  | { type: "ellipsis"; key: "left" | "right" };

export function getPaginationWindow(
  currentPage: number,
  totalPages: number,
  siblingCount?: number,
): PaginationWindowItem[];
