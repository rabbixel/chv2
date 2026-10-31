import Link from "next/link";
import { routes } from "@/lib/routes";
import styles from "./TrendingKeywords.module.css";
import { SectionHeading } from "./SectionHeading";

export interface TrendingKeywordsProps {
  keywords: string[];
  heading?: string;
  eyebrow?: string;
  description?: string;
}

export function TrendingKeywords({ keywords, heading = "Explore popular themes", eyebrow = "", description = "" }: TrendingKeywordsProps) {
  if (!keywords.length) return null;
  return (
    <section aria-labelledby="trending-heading" className={styles.section}>
      <h2 id="trending-heading" className={eyebrow || description ? "ch-visually-hidden" : styles.heading}>{heading}</h2>
      {(eyebrow || description) && <SectionHeading eyebrow={eyebrow} title={heading} copy={description} />}
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
