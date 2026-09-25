import Link from "next/link";
import { routes } from "@/lib/routes";
import {
  buildListingHref,
  parseListingParams,
} from "@/lib/search-params";
import { productGroups } from "@/lib/taxonomy";
import type { Collection } from "@/lib/types";
import styles from "./NoResults.module.css";

export interface NoResultsProps {
  query: string;
  popularSearches: string[];
  collections: Collection[];
}

export function NoResults({ query, popularSearches, collections }: NoResultsProps) {
  const groupHref = (group: string) =>
    buildListingHref(
      "/search",
      parseListingParams({
        q: query,
        group,
      }),
    );

  return (
    <div className={styles.empty}>
      <p className={styles.title}>
        {query ? (
          <>
            No results for <q className={styles.query}>{query}</q>
          </>
        ) : (
          "No products match those filters"
        )}
      </p>
      <p className={styles.copy}>
        Try a simpler keyword — single words like “diwali”, “logo” or
        “character” work best — or start from one of these shelves.
      </p>

      <div className={styles.sections}>
        <section aria-label="Popular searches">
          <p className={styles.heading}>Popular searches</p>
          <ul className={styles.chips}>
            {popularSearches.map((term) => (
              <li key={term}>
                <Link href={routes.search(term)} className={styles.chip}>
                  {term}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Product groups">
          <p className={styles.heading}>Browse a group</p>
          <ul className={styles.chips}>
            {productGroups.map((group) => (
              <li key={group.slug}>
                <Link href={groupHref(group.slug)} className={styles.chip}>
                  {group.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Collections">
          <p className={styles.heading}>Explore collections</p>
          <ul className={styles.chips}>
            {collections.slice(0, 8).map((collection) => (
              <li key={collection.id}>
                <Link
                  href={routes.search(collection.query)}
                  className={styles.chip}
                >
                  {collection.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
