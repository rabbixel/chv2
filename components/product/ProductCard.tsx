import Link from "next/link";
import type { CSSProperties } from "react";
import { Badge, Card } from "@/components/ui";
import { routes } from "@/lib/routes";
import type { Product } from "@/lib/types";
import {
  cn,
  discountPercent,
  formatCompact,
  formatMoney,
} from "@/lib/utils";
import styles from "./ProductCard.module.css";

export interface ProductCardProps {
  product: Product;
}

function PlaceholderArt({ product }: { product: Product }) {
  const art = product.images[0]?.placeholder;
  const hue = art?.hue ?? 150;
  return (
    <span
      className={styles.placeholder}
      style={{ "--ch-art-hue": hue } as CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.monogram}>{art?.label ?? "CH"}</span>
    </span>
  );
}

export function ProductCard({ product }: ProductCardProps) {
  const href = routes.product(product.slug);
  const percent = discountPercent(product.compareAtPrice, product.price);
  const cover = product.images[0];

  return (
    <Card padding="none" interactive className={styles.card}>
      <Link
        href={href}
        className={styles.media}
        aria-label={product.title}
        tabIndex={-1}
      >
        {cover?.url ? (
          // Real CDN imagery lands with the API; until then every product
          // carries a deterministic flat placeholder (see data/products.ts).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt="" className={styles.image} loading="lazy" />
        ) : (
          <PlaceholderArt product={product} />
        )}
        <span className={styles.badges}>
          {percent !== null && (
            <Badge variant="danger" size="sm">
              −{percent}%
            </Badge>
          )}
          {product.bestseller && (
            <Badge variant="accent" size="sm">
              Bestseller
            </Badge>
          )}
          {product.isNew && (
            <Badge variant="brand" size="sm">
              New
            </Badge>
          )}
        </span>
      </Link>
      <div className={styles.body}>
        <p className={styles.fileTypes}>{product.fileTypes.join(" · ")}</p>
        <h3 className={styles.title}>
          <Link href={href} className={styles.titleLink}>
            {product.title}
          </Link>
        </h3>
        <p className={styles.meta}>
          <span
            className={styles.rating}
            aria-label={`Rated ${product.ratingAverage} out of 5`}
          >
            ★ {product.ratingAverage.toFixed(1)}
          </span>
          <span className={styles.counts}>
            ({formatCompact(product.ratingCount)}) ·{" "}
            {formatCompact(product.salesCount)} sales
          </span>
        </p>
        <p className={styles.priceRow}>
          <span className={styles.price}>{formatMoney(product.price)}</span>
          {product.compareAtPrice && (
            <s className={cn(styles.compareAt)}>
              {formatMoney(product.compareAtPrice)}
            </s>
          )}
        </p>
      </div>
    </Card>
  );
}
