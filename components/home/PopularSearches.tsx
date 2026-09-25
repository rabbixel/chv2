import Link from "next/link";
import { Icon } from "@/components/ui";
import { routes } from "@/lib/routes";
import styles from "./PopularSearches.module.css";

export interface PopularSearchesProps {
  searches: string[];
}

export function PopularSearches({ searches }: PopularSearchesProps) {
  return (
    <section aria-labelledby="popular-searches-heading" className={styles.section}>
      <div className="ch-container">
        <div className={styles.inner}>
          <h2 id="popular-searches-heading" className={styles.heading}>
            <Icon name="trend" size={18} />
            Popular Searches
          </h2>
          <ul className={styles.chips}>
            {searches.map((term) => (
              <li key={term}>
                <Link href={routes.search(term)} className={styles.chip}>
                  {term}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
