import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon } from "@/components/ui";
import { routes } from "@/lib/routes";
import { SectionHeading } from "./SectionHeading";
import styles from "./CharacterCategories.module.css";

export interface CharacterCategoryWithCount {
  name: string;
  blurb: string;
  query: string;
  hue: number;
  count: number;
}

export interface CharacterCategoriesProps {
  categories: CharacterCategoryWithCount[];
}

export function CharacterCategories({ categories }: CharacterCategoriesProps) {
  return (
    <section aria-labelledby="characters-heading">
      <SectionHeading
        eyebrow="Same character, every pose"
        title="Featured Character Categories"
        copy="Consistent characters in varied actions and poses — mythology, professions, culture and festivals."
      />
      <h2 id="characters-heading" className="ch-visually-hidden">
        Featured character categories
      </h2>
      <ul className={styles.grid}>
        {categories.map((category) => (
          <li key={category.name}>
            <Link
              href={routes.search(category.query)}
              className={styles.card}
              style={{ "--card-hue": category.hue } as CSSProperties}
            >
              <span className={styles.art} aria-hidden="true">
                {category.name.charAt(0)}
              </span>
              <span className={styles.body}>
                <span className={styles.name}>{category.name}</span>
                <span className={styles.blurb}>{category.blurb}</span>
                <span className={styles.meta}>
                  {category.count} {category.count === 1 ? "asset" : "assets"}
                  <Icon name="arrow-right" size={16} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
