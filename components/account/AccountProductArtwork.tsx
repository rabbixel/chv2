import Image from "next/image";
import { ProductImage } from "@/components/product/ProductImage";
import type { ProductImage as ProductImageData } from "@/lib/types";
import styles from "./AccountProductArtwork.module.css";

interface AccountProductArtworkProps {
  title: string;
  image?: ProductImageData;
  fallbackUrl?: string | null;
}

export function AccountProductArtwork({
  title,
  image,
  fallbackUrl,
}: AccountProductArtworkProps) {
  return (
    <span className={styles.frame} aria-hidden="true">
      {image?.url ? (
        <ProductImage image={image} title={title} sizes="72px" decorative className={styles.image} />
      ) : fallbackUrl ? (
        <Image src={fallbackUrl} alt="" fill sizes="72px" unoptimized className={styles.image} />
      ) : (
        title.trim().charAt(0).toLocaleUpperCase()
      )}
    </span>
  );
}
