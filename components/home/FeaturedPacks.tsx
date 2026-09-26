import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon } from "@/components/ui";
import { routes } from "@/lib/routes";
import type { Collection } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./SectionHeading";
import styles from "./FeaturedPacks.module.css";

export interface FeaturedPacksProps {
  packs: Collection[];
}

export function FeaturedPacks({ packs }: FeaturedPacksProps) {
  if (packs.length === 0) return null;
  const [lead, ...rest] = packs;

  const renderCard = (pack: Collection, large: boolean) => (
    <Link
      key={pack.id}
      href={routes.collection(pack.slug)}
      className={cn(styles.card, large && styles.lead)}
      style={{ "--pack-hue": pack.hue } as CSSProperties}
    >
      <span className={styles.art} aria-hidden="true">
        <span className={styles.kicker}>Featured pack</span>
        <span className={styles.packTitle}>{pack.title}</span>
      </span>
      <span className={styles.body}>
        <span className={styles.tagline}>{pack.tagline}</span>
        <span className={styles.explore}>
          Explore collection
          <Icon name="arrow-right" size={16} />
        </span>
      </span>
    </Link>
  );

  return (
    <section aria-labelledby="packs-heading">
      <SectionHeading
        eyebrow="Handpicked packs"
        title="Featured Graphics & Illustration Packs"
        copy="Festival-ready illustration packs, curated the Hatti way — themed, consistent and ready to ship."
      />
      <h2 id="packs-heading" className="ch-visually-hidden">
        Featured graphics packs
      </h2>
      <div className={styles.grid}>
        {lead && renderCard(lead, true)}
        {rest.map((pack) => renderCard(pack, false))}
      </div>
    </section>
  );
}
