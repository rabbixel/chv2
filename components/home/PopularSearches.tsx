import Link from "next/link";
import { Icon } from "@/components/ui";
import { routes } from "@/lib/routes";
import styles from "./PopularSearches.module.css";
import type { SearchChip } from "@/lib/seasonal-searches";

export interface PopularSearchesProps {
  searches: SearchChip[];
  heading?: string;
}

export function PopularSearches({ searches, heading = "Popular Searches" }: PopularSearchesProps) {
  return (
    <section aria-labelledby="popular-searches-heading" className={styles.section}>
      <div className="ch-container ch-container--wide">
        <div className={styles.inner}>
          <h2 id="popular-searches-heading" className={styles.heading}>
            <Icon name="trend" size={18} />
            {heading}
          </h2>
          <ul className={styles.chips}>
            {searches.map((term) => (
              <li key={term.searchQuery}>
                <Link href={routes.search(term.searchQuery)} className={styles.chip}>
                  {term.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
