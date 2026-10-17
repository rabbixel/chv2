"use client";

import { useState, type CSSProperties } from "react";
import { ProductImage } from "@/components/product/ProductImage";
import { wishlistImageSource } from "@/lib/creative-hatti/wishlist";
import type { ProductImage as ProductImageData } from "@/lib/types";
import styles from "./WishlistProductArtwork.module.css";

interface WishlistProductArtworkProps {
  image?: ProductImageData;
  title: string;
  placeholderLabel: string;
  placeholderHue: number;
  className?: string;
  imageClassName?: string;
}

/** Wishlist artwork uses the product's original API URL and falls back on load failure. */
export function WishlistProductArtwork({
  image,
  title,
  placeholderLabel,
  placeholderHue,
  className,
  imageClassName,
}: WishlistProductArtworkProps) {
  const [failed, setFailed] = useState(false);
  const source = wishlistImageSource(image);

  return (
    <span
      className={className}
      style={{ "--ch-art-hue": placeholderHue } as CSSProperties}
      aria-hidden="true"
    >
      {source && !failed ? (
        <ProductImage
          image={{ ...image!, url: source }}
          title={title}
          sizes="(max-width: 639px) 100vw, (max-width: 1099px) 50vw, 33vw"
          decorative
          className={imageClassName ?? styles.image}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={styles.monogram}>{placeholderLabel}</span>
      )}
    </span>
  );
}
