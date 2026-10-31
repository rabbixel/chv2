import Image from "next/image";
import Link from "next/link";
import { routes } from "@/lib/routes";
import type { CSSProperties } from "react";
import { isLocalWordPressMediaUrl } from "@/lib/creative-hatti/media";
import { popularFreebieArtwork } from "@/lib/creative-hatti/popular-freebies-artwork.mjs";
import type { Product } from "@/lib/types";
import { SectionHeading } from "./SectionHeading";
import styles from "./PopularFreebies.module.css";

export interface PopularFreebiesProps {
  products: Product[];
  copy?: { eyebrow?: string; heading?: string; description?: string; browse_label?: string; browse_url?: string };
}

export function PopularFreebies({ products, copy }: PopularFreebiesProps) {
  const items = products.slice(0, 8).flatMap((product) => {
    const image = popularFreebieArtwork(product.images);
    return image ? [{ product, image }] : [];
  });

  if (items.length === 0) return null;

  return (
    <section aria-label="Popular free character illustrations">
      <SectionHeading
        eyebrow={copy?.eyebrow ?? "Free character illustrations"}
        title={copy?.heading ?? "Popular Freebies"}
        copy={copy?.description ?? "Explore free character artwork loved by the Hatti community."}
        actionHref={copy?.browse_url ?? routes.freeDownloads()}
        actionLabel={copy?.browse_label ?? "Browse all free downloads"}
      />
      <ul
        className={styles.gallery}
        style={{ "--gallery-count": items.length } as CSSProperties}
        aria-label="Popular free character illustrations"
        tabIndex={0}
      >
        {items.map(({ product, image }) => (
          <li className={styles.item} key={product.id}>
            <Link
              href={routes.product(product.slug)}
              className={styles.artworkLink}
              aria-label={`View free character illustration: ${product.title}`}
            >
              <span className={styles.artwork}>
                <Image
                  src={image.url}
                  alt={image.alt.trim() || `${product.title} character illustration`}
                  fill
                  sizes="(max-width: 639px) 40vw, (max-width: 1023px) 22vw, 12vw"
                  className={styles.image}
                  unoptimized={process.env.NODE_ENV !== "production" && isLocalWordPressMediaUrl(image.url)}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
