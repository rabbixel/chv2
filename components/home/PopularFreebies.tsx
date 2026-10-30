import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { routes } from "@/lib/routes";
import { isLocalWordPressMediaUrl } from "@/lib/creative-hatti/media";
import type { Product, ProductImage } from "@/lib/types";
import { SectionHeading } from "./SectionHeading";
import styles from "./PopularFreebies.module.css";

export interface PopularFreebiesProps {
  products: Product[];
}

function bestArtwork(images: ProductImage[]): ProductImage | undefined {
  return images
    .filter((image) => image.url.trim().length > 0)
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0];
}

export function PopularFreebies({ products }: PopularFreebiesProps) {
  const items = products.slice(0, 8).flatMap((product) => {
    const image = bestArtwork(product.images);
    return image ? [{ product, image }] : [];
  });

  if (items.length === 0) return null;

  return (
    <section aria-label="Popular free character illustrations">
      <SectionHeading
        eyebrow="Free character illustrations"
        title="Popular Freebies"
        copy="Explore free character artwork loved by the Hatti community."
        actionHref={routes.freeDownloads()}
        actionLabel="Browse all free downloads"
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
