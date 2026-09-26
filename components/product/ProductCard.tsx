import Link from "next/link";
import type { CSSProperties } from "react";
import { Badge, Card } from "@/components/ui";
import { routes } from "@/lib/routes";
import { categoryDisplayName } from "@/lib/taxonomy";
import type { Product, ProductKind } from "@/lib/types";
import {
  cn,
  discountPercent,
  formatCompact,
  formatMoney,
} from "@/lib/utils";
import { ProductImage as ProductImageView } from "./ProductImage";
import { WishlistButton } from "./WishlistButton";
import styles from "./ProductCard.module.css";

const KIND_LABELS: Record<ProductKind, string> = {
  vector: "Vector",
  bundle: "Bundle",
  freebie: "Freebie",
};

export interface ProductCardProps {
  product: Product;
  /** Initial wishlist state (resolved by the listing page later). */
  wishlisted?: boolean;
  /**
   * Card title level. Listing pages (cards directly under the h1)
   * pass "h2"; cards inside h2 sections keep the default "h3".
   */
  titleAs?: "h2" | "h3";
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

export function ProductCard({
  product,
  wishlisted = false,
  titleAs = "h3",
}: ProductCardProps) {
  const Title = titleAs;
  const href = routes.product(product.slug);
  const percent = discountPercent(product.compareAtPrice, product.price);
  const cover = product.images[0];
  const kicker = [
    KIND_LABELS[product.kind],
    categoryDisplayName(product.categorySlugs[0] ?? product.productGroup),
    product.isCustomizable ? "Customizable" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card padding="none" interactive className={styles.card}>
      <div className={styles.mediaWrap}>
        <Link
          href={href}
          className={styles.media}
          aria-label={product.title}
          tabIndex={-1}
        >
          {cover?.url ? (
            // Real CDN imagery lands with the API; until then every product
            // carries a deterministic flat placeholder (see data/products.ts).
            <ProductImageView
              image={cover}
              title={product.title}
              sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
              decorative
              className={styles.image}
            />
          ) : (
            <PlaceholderArt product={product} />
          )}
        </Link>
        <span className={styles.badges} aria-hidden="true">
          {product.isFree && (
            <Badge variant="success" size="sm">
              Free
            </Badge>
          )}
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
        <WishlistButton
          productId={product.id}
          productTitle={product.title}
          initialWishlisted={wishlisted}
          className={styles.wishlist}
        />
      </div>
      <div className={styles.body}>
        <p className={styles.kicker}>{kicker}</p>
        <Title className={styles.title}>
          <Link href={href} className={styles.titleLink}>
            {product.title}
          </Link>
        </Title>
        {(product.bestseller || product.isNew) && (
          <span className="ch-visually-hidden">
            {product.bestseller ? "Bestseller. " : ""}
            {product.isNew ? "New arrival." : ""}
          </span>
        )}
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
          {product.isFree ? (
            <span className={styles.free}>Free download</span>
          ) : (
            <>
              <span className={styles.price}>{formatMoney(product.price)}</span>
              {product.compareAtPrice && (
                <s className={cn(styles.compareAt)}>
                  {formatMoney(product.compareAtPrice)}
                </s>
              )}
            </>
          )}
        </p>
      </div>
    </Card>
  );
}
