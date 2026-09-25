import { cn } from "@/lib/utils";
import gridStyles from "./ProductGrid.module.css";
import styles from "./ProductGridSkeleton.module.css";

export interface ProductGridSkeletonProps {
  count?: number;
  className?: string;
}

/** Loading placeholder for product listings (Suspense fallback). */
export function ProductGridSkeleton({
  count = 8,
  className,
}: ProductGridSkeletonProps) {
  return (
    <div className={cn(gridStyles.wrapper, className)}>
      <p className="ch-visually-hidden" role="status">
        Loading products…
      </p>
      <ul aria-hidden="true" className={gridStyles.grid}>
        {Array.from({ length: count }, (_, index) => (
          <li key={index} className={gridStyles.cell}>
            <div className={styles.card}>
              <span className={styles.media} />
              <span className={styles.body}>
                <span className={styles.line} />
                <span className={styles.line} />
                <span className={`${styles.line} ${styles.short}`} />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
