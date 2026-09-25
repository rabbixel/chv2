import Link from "next/link";
import { routes } from "@/lib/routes";
import styles from "./TrendingKeywords.module.css";

export interface TrendingKeywordsProps {
  keywords: string[];
}

export function TrendingKeywords({ keywords }: TrendingKeywordsProps) {
  return (
    <section aria-labelledby="trending-heading" className={styles.section}>
      <h2 id="trending-heading" className={styles.heading}>
        Trending Keywords
      </h2>
      <ul className={styles.chips}>
        {keywords.map((keyword) => (
          <li key={keyword}>
            <Link href={routes.search(keyword)} className={styles.chip}>
              {keyword}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
