import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon } from "@/components/ui";
import type { DiscoveryTile } from "@/lib/homepage";
import { routes } from "@/lib/routes";
import { SectionHeading } from "./SectionHeading";
import styles from "./DiscoveryGrid.module.css";
import { TileArtwork } from "./TileArtwork";

export interface DiscoveryGridProps {
  tiles: DiscoveryTile[];
  copy?: { eyebrow?: string; heading?: string; description?: string };
}

export function DiscoveryGrid({ tiles, copy }: DiscoveryGridProps) {
  if (!tiles.length) return null;
  return (
    <section aria-labelledby="discovery-heading">
      <SectionHeading
        eyebrow={copy?.eyebrow ?? "Start exploring"}
        title={copy?.heading ?? "What are you creating today?"}
        copy={copy?.description ?? "Jump straight into the aisles of the Hatti — every tile opens a curated corner of the marketplace."}
      />
      <h2 id="discovery-heading" className="ch-visually-hidden">
        Discovery categories
      </h2>
      <ul className={styles.grid}>
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Link
              href={tile.href ?? routes.search(tile.query)}
              className={styles.tile}
              style={{ "--tile-hue": tile.hue } as CSSProperties}
            >
              <span className={styles.swatch} aria-hidden="true">
                <TileArtwork image={tile.image} name={tile.icon || tile.label} />
              </span>
              <span className={styles.text}>
                <span className={styles.label}>{tile.label}</span>
                <span className={styles.caption}>{tile.caption}</span>
              </span>
              <Icon name="arrow-right" size={18} className={styles.arrow} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
