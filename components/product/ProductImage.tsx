import NextImage from "next/image";
import type { ProductImage as ProductImageType } from "@/lib/types";

export interface ProductImageProps {
  image: ProductImageType;
  /** Fallback accessible name when the image ships no alt text. */
  title: string;
  /** `sizes` for the slot this image fills (card vs gallery stage). */
  sizes: string;
  className?: string;
  /** Above-the-fold hero only — every other image lazy-loads. */
  priority?: boolean;
  decorative?: boolean;
}

/**
 * Real product imagery via `next/image`: responsive `srcset`, lazy
 * loading, and `fill` inside aspect-locked slots (no layout shift).
 * Renders only when a CDN URL exists — mock data uses flat placeholders.
 */
export function ProductImage({
  image,
  title,
  sizes,
  className,
  priority = false,
  decorative = false,
}: ProductImageProps) {
  if (!image.url) return null;
  return (
    <NextImage
      src={image.url}
      alt={decorative ? "" : image.alt || title}
      aria-hidden={decorative || undefined}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      draggable={false}
    />
  );
}
