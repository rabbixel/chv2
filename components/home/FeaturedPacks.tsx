import Link from "next/link";
import { Icon } from "@/components/ui";
import { routes } from "@/lib/routes";
import type { Collection } from "@/lib/types";
import type { ProductImage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./SectionHeading";
import { CardArtwork } from "./CardArtwork";
import styles from "./FeaturedPacks.module.css";
import { getProductService } from "@/lib/services";

export interface FeaturedPacksProps {
  packs: Collection[];
  copy?: { eyebrow?: string; heading?: string; description?: string };
}

export async function FeaturedPacks({ packs, copy }: FeaturedPacksProps) {
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
  const renderCard = (
    pack: Collection & { image?: ProductImage },
    large: boolean,
  ) => {
    const imageAspectRatio = pack.image?.width && pack.image.height
      ? `${pack.image.width} / ${pack.image.height}`
      : "16 / 9";

    return (
      <Link
        key={pack.id}
        href={pack.href ?? routes.collection(pack.slug)}
        className={cn(styles.card, large && styles.lead)}
      >
        <span className={styles.imageArea} style={{ aspectRatio: imageAspectRatio }}>
          <CardArtwork
            variant={pack.artwork ?? "festival"}
            hue={pack.hue}
            image={pack.image}
            sizes={large
              ? "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 50vw"
              : "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"}
          />
        </span>
        <span className={styles.cardContent}>
          <span className={styles.titlePanel}>
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
        </span>
      </Link>
    );
  };

  return (
    <section aria-labelledby="packs-heading">
      <SectionHeading
        eyebrow={copy?.eyebrow ?? "Handpicked packs"}
        title={copy?.heading ?? "Featured Graphics & Illustration Packs"}
        copy={copy?.description ?? "Festival-ready illustration packs, curated the Hatti way — themed, consistent and ready to ship."}
      />
      <h2 id="packs-heading" className="ch-visually-hidden">
        Featured graphics packs
      </h2>
      <div className={styles.grid}>
        {packsWithImages.map((pack, index) =>
          renderCard(pack, index === 0),
        )}
      </div>
    </section>
  );
}
