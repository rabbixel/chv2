"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { QuickAddButton } from "@/components/product/QuickAddButton";
import { ProductImage } from "@/components/product/ProductImage";
import { WishlistButton } from "@/components/product/WishlistButton";
import { routes } from "@/lib/routes";
import type { Product } from "@/lib/types";
import { categoryDisplayName } from "@/lib/taxonomy";
import { formatMoney } from "@/lib/utils";
import { buildJustifiedRows } from "./justified-layout.mjs";
import styles from "./GalleryPreview.module.css";

type Density = "compact" | "comfortable";
type OverlayMode = "hover" | "always";

interface GalleryPreviewProps {
  products: Product[];
  density: Density;
  overlayMode: OverlayMode;
  returnTo?: string;
}

function GalleryTile({
  product,
  width,
  height,
  overlayMode,
  returnTo,
}: {
  product: Product;
  width: number;
  height: number;
  overlayMode: OverlayMode;
  returnTo?: string;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const image = product.images[0];
  const href = routes.product(product.slug);
  const category = categoryDisplayName(product.categorySlugs[0] ?? product.productGroup);
  const priceLabel = product.isFree
    ? "Free download"
    : product.priceClass === "mixed"
      ? `Options from ${formatMoney(product.price)}`
      : product.priceClass === "invalid" || product.priceValid === false
        ? "Price unavailable"
        : formatMoney(product.price);

  function revealDetailsOnTouch(event: MouseEvent<HTMLAnchorElement>) {
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches && !detailsOpen) {
      event.preventDefault();
      setDetailsOpen(true);
    }
  }

  return (
    <article
      className={styles.tile}
      style={{ width, height }}
      data-overlay-mode={overlayMode}
      data-details-open={detailsOpen || undefined}
      aria-label={product.title}
      aria-describedby={`gallery-tile-hint-${product.id}`}
      tabIndex={0}
    >
      <span className="ch-visually-hidden" id={`gallery-tile-hint-${product.id}`}>
        On touch screens, tap the artwork once to reveal details, then tap again to open the product.
      </span>
      {image?.url && !imageFailed ? (
        <Link href={href} className={styles.imageLink} aria-label={`View ${product.title}`} onClick={revealDetailsOnTouch} tabIndex={-1}>
          <ProductImage
            image={image}
            title={product.title}
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 48vw, 30vw"
            decorative
            className={styles.image}
            onError={() => setImageFailed(true)}
          />
        </Link>
      ) : (
        <div className={styles.missingImage} aria-label={`Preview unavailable for ${product.title}`}>
          <span>Preview unavailable</span>
        </div>
      )}

      <div className={styles.quickActions} role="group" aria-label={`Actions for ${product.title}`}>
        <WishlistButton
          productId={product.id}
          productTitle={product.title}
          returnTo={returnTo ?? routes.galleryPreview()}
          className={styles.wishlistAction}
        />
        {!product.isFree && product.status === "active" && product.soldOut !== true && product.purchasable !== false && (
          <QuickAddButton product={product} />
        )}
      </div>

      <div className={styles.overlay}>
        <div className={styles.overlayContent}>
          <Link className={styles.title} href={href} title={product.title} aria-label={product.title}>
            {product.title}
          </Link>
          <p className={styles.category}>{category}<span aria-hidden="true"> · </span>{priceLabel}</p>
          <Link className={styles.eyeAction} href={href} aria-label="View product" title="View product" data-tooltip="View product">
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" focusable="false">
              <path d="M2.2 12s3.4-6.2 9.8-6.2 9.8 6.2 9.8 6.2-3.4 6.2-9.8 6.2S2.2 12 2.2 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}

export function GalleryPreview({ products, density, overlayMode, returnTo }: GalleryPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const gap = 8;
  const targetHeight = density === "compact" ? 190 : 250;

  const measure = useCallback(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.getBoundingClientRect().width);
    }
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);

  const rows = useMemo(
    () => buildJustifiedRows(products, containerWidth, targetHeight, gap),
    [products, containerWidth, targetHeight],
  );

  if (products.length === 0) return null;

  return (
    <div ref={containerRef} className={styles.gallery} aria-label="Product artwork gallery">
      {rows.map((row, rowIndex) => (
        <div className={styles.row} key={`row-${rowIndex}`} style={{ gap, height: row.height }}>
          {row.items.map(({ item, width }) => (
            <GalleryTile
              key={item.id}
              product={item}
              width={width}
              height={row.height}
              overlayMode={overlayMode}
              returnTo={returnTo}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
