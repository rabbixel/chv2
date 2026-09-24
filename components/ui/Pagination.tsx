import Link from "next/link";
import { cn } from "@/lib/utils";
import { getPageWindow } from "@/lib/utils";
import styles from "./Pagination.module.css";

export interface PaginationProps {
  page: number;
  totalPages: number;
  /** Build the URL for a page (keeps filters/sort in the query string). */
  buildHref: (page: number) => string;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  buildHref,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const window = getPageWindow(page, totalPages);
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  return (
    <nav aria-label="Pagination" className={cn(styles.nav, className)}>
      <Link
        href={buildHref(prevPage)}
        aria-disabled={page === 1}
        aria-label="Previous page"
        className={cn(styles.link, styles.edge, page === 1 && styles.disabled)}
      >
        ← Prev
      </Link>
      <ol className={styles.list}>
        {window.map((entry, index) =>
          entry === "…" ? (
            <li key={`gap-${index}`} aria-hidden="true" className={styles.gap}>
              …
            </li>
          ) : (
            <li key={entry}>
              <Link
                href={buildHref(entry)}
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? "page" : undefined}
                className={cn(
                  styles.link,
                  entry === page && styles.current,
                )}
              >
                {entry}
              </Link>
            </li>
          ),
        )}
      </ol>
      <Link
        href={buildHref(nextPage)}
        aria-disabled={page === totalPages}
        aria-label="Next page"
        className={cn(
          styles.link,
          styles.edge,
          page === totalPages && styles.disabled,
        )}
      >
        Next →
      </Link>
    </nav>
  );
}
