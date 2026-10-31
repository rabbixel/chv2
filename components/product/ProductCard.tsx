import Link from "next/link";
import type { CSSProperties } from "react";
import { Badge, Card } from "@/components/ui";
import { routes } from "@/lib/routes";
import { categoryDisplayName } from "@/lib/taxonomy";
import { SHOW_PRODUCT_SOCIAL_PROOF } from "@/lib/constants";
import type { Product, ProductKind } from "@/lib/types";
import {
  cn,
  discountPercent,
  formatCompact,
  formatMoney,
} from "@/lib/utils";
import { ProductImage as ProductImageView } from "./ProductImage";
import { FreeDownloadAction } from "./FreeDownloadAction";
import { QuickAddButton } from "./QuickAddButton";
import { WishlistButton } from "./WishlistButton";
import styles from "./ProductCard.module.css";

const KIND_LABELS: Record<ProductKind, string> = {
  vector: "Vector",
  bundle: "Bundle",
  freebie: "Freebie",
};

export interface ProductCardProps {
  product: Product;
  /** Homepage merchandising: show the entire artwork in a larger square slot. */
  artworkPreview?: boolean;
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
  artworkPreview = false,
}: ProductCardProps) {
  const Title = titleAs;
  const href = routes.product(product.slug);
  const percent = discountPercent(product.compareAtPrice, product.price);
  const cover = product.images[0];
  const imageSizes = artworkPreview
    ? "(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 300px"
    : "(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw";
  const kicker = [
    KIND_LABELS[product.kind],
    categoryDisplayName(product.categorySlugs[0] ?? product.productGroup),
    product.isCustomizable ? "Customizable" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const titleElement = (
    <Title className={cn(styles.title, product.isFree && styles.freeTitle)}>
      <Link href={href} className={styles.titleLink} title={product.title} aria-label={product.title}>
        {product.title}
      </Link>
    </Title>
  );

  return (
    <Card padding="none" interactive className={cn(styles.card, artworkPreview && styles.artworkPreview)}>
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
              sizes={imageSizes}
              decorative
              className={styles.image}
            />
          ) : (
            <PlaceholderArt product={product} />
          )}
        </Link>
        <span className={styles.badges}>
          {product.soldOut && <Badge variant="danger" size="sm">Sold Out</Badge>}
          {product.purchasable === false && !product.soldOut && <Badge variant="danger" size="sm">Temporarily unavailable</Badge>}
          {product.isFree && (
            <Badge variant="brand" size="sm" className={styles.freeBadge}>
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
        <div className={styles.actions}>
          <WishlistButton
            key={product.id}
            productId={product.id}
            productTitle={product.title}
            initialWishlisted={wishlisted}
            returnTo={href}
          />
          <QuickAddButton product={product} />
        </div>
      </div>
      <div className={cn(styles.body, product.isFree && styles.freeBody)}>
        {product.isFree ? (
          <div className={styles.freeInfoRow}>
            <div className={styles.freeTextGroup}>
              <p className={styles.kicker}>{kicker}</p>
              {titleElement}
            </div>
            <FreeDownloadAction
              slug={product.slug}
              title={product.title}
              priceOptions={product.priceOptions}
            />
          </div>
        ) : (
          <>
            <p className={styles.kicker}>{kicker}</p>
            {titleElement}
          </>
        )}
        {(product.bestseller || product.isNew) && (
          <span className="ch-visually-hidden">
            {product.bestseller ? "Bestseller. " : ""}
            {product.isNew ? "New arrival." : ""}
          </span>
        )}
        {SHOW_PRODUCT_SOCIAL_PROOF &&
          (product.ratingCount > 0 || product.salesCount > 0) && (
            <p className={styles.meta}>
              {product.ratingCount > 0 && (
                <>
                  <span
                    className={styles.rating}
                    aria-label={`Rated ${product.ratingAverage} out of 5`}
                  >
                    ★ {product.ratingAverage.toFixed(1)}
                  </span>
                  <span className={styles.counts}>
                    ({formatCompact(product.ratingCount)})
                  </span>
                </>
              )}
              {product.salesCount > 0 && (
                <span className={styles.counts}>
                  {formatCompact(product.salesCount)} sales
                </span>
              )}
            </p>
          )}
        {!product.isFree && <p className={styles.priceRow}>
          {product.priceClass === "mixed" ? (
            <span className={styles.price}>Options from {Number.isFinite(product.price.amount) ? formatMoney(product.price) : "Price unavailable"}</span>
          ) : (
            <>
              <span className={styles.price}>{product.priceClass === "invalid" || product.priceValid === false ? "Price unavailable" : Number.isFinite(product.price.amount) ? formatMoney(product.price) : "Price unavailable"}</span>
              {product.compareAtPrice && (
                <s className={cn(styles.compareAt)}>
                  {formatMoney(product.compareAtPrice)}
                </s>
              )}
            </>
          )}
        </p>}
      </div>
    </Card>
  );
}
