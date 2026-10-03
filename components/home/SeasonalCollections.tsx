import Link from "next/link";
import type { CSSProperties } from "react";
import { routes } from "@/lib/routes";
import type { Collection } from "@/lib/types";
import { SectionHeading } from "./SectionHeading";
import styles from "./SeasonalCollections.module.css";
import { TileArtwork } from "./TileArtwork";

export interface SeasonalCollectionsProps {
  items: Collection[];
}

export function SeasonalCollections({ items }: SeasonalCollectionsProps) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="seasonal-heading">
      <SectionHeading
        eyebrow="Seasonal & topical"
        title="Collections for every celebration"
        copy="Diwali to Bollywood — topical shelves that refresh with the Indian festive calendar."
      />
      <h2 id="seasonal-heading" className="ch-visually-hidden">
        Seasonal collections
      </h2>
      <ul className={styles.grid}>
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href ?? routes.collection(item.slug)}
              className={styles.tile}
              style={{ "--tile-hue": item.hue } as CSSProperties}
            >
              <span className={styles.swatch} aria-hidden="true">
                <TileArtwork image={item.coverImage} name={item.query} />
              </span>
              <span className={styles.label}>{item.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
