import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon } from "@/components/ui";
import { routes } from "@/lib/routes";
import type { Collection } from "@/lib/types";
import type { ProductImage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./SectionHeading";
import { CardArtwork, type CardArtworkVariant } from "./CardArtwork";
import styles from "./FeaturedPacks.module.css";
import { getProductService } from "@/lib/services";

export interface FeaturedPacksProps {
  packs: Collection[];
}

const PACK_ARTWORK: Record<string, CardArtworkVariant> = {
  "maha-shivratri": "shivratri",
  "republic-day": "republic-day",
  "vasant-panchami": "vasant-panchami",
  "valentine-day": "valentine",
  navratri: "navratri",
};

export async function FeaturedPacks({ packs }: FeaturedPacksProps) {
  if (packs.length === 0) return null;
  const productService = getProductService();
  const packsWithImages = await Promise.all(
    packs.map(async (pack) => {
      if (pack.coverImage || !pack.coverProductSlug) {
        return { ...pack, image: pack.coverImage };
      }
      const product = await productService.getProductBySlug(pack.coverProductSlug);
      const image = product?.images.find((productImage): productImage is ProductImage =>
        Boolean(productImage.url),
      );
      return { ...pack, image };
    }),
  );
  const [leadWithImage, ...restWithImages] = packsWithImages;

  const renderCard = (
    pack: Collection & { image?: ProductImage },
    large: boolean,
  ) => (
    <Link
      key={pack.id}
      href={pack.href ?? routes.collection(pack.slug)}
      className={cn(styles.card, large && styles.lead)}
      style={{ "--pack-hue": pack.hue } as CSSProperties}
    >
      <span className={styles.art}>
        <CardArtwork
          variant={pack.artwork ?? PACK_ARTWORK[pack.slug] ?? "festival"}
          hue={pack.hue}
          image={pack.image}
          sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
        />
        <span className={styles.artCopy}>
          <span className={styles.kicker}>Featured pack</span>
          <span className={styles.packTitle}>{pack.title}</span>
        </span>
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
        {leadWithImage && renderCard(leadWithImage, true)}
        {restWithImages.map((pack) => renderCard(pack, false))}
      </div>
    </section>
  );
}
