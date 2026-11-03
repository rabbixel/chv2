import NextImage from "next/image";
import type { ComponentProps } from "react";
import type { ProductImage as ProductImageType } from "@/lib/types";

export interface ProductImageProps {
  image: ProductImageType;
  /** Fallback accessible name when the image ships no alt text. */
  title: string;
  /** `sizes` for the slot this image fills (card vs gallery stage). */
  sizes: string;
  className?: string;
  /** Eager-load an above-the-fold LCP candidate; other images remain lazy. */
  priority?: boolean;
  decorative?: boolean;
  /** Optional image-load fallback for cards that can render a placeholder. */
  onError?: ComponentProps<typeof NextImage>["onError"];
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
  onError,
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
      onError={onError}
      // Serve WordPress-generated product previews directly. Vercel's image
      // optimizer currently returns 402 in production, which leaves every
      // optimized product thumbnail broken. The media URLs already point at
      // appropriately sized generated files.
      unoptimized
      draggable={false}
    />
  );
}
