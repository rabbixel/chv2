import Image from "next/image";
import type { FeaturedClientBrand } from "@/lib/creative-hatti/clients";
import type { TrustedBrand } from "@/lib/services/homepageService";
import { isLocalWordPressMediaUrl } from "@/lib/creative-hatti/media";
import styles from "./ClientLogoGrid.module.css";

type ClientLogo = TrustedBrand | FeaturedClientBrand;

export function ClientLogoGrid({
  brands,
  layout = "directory",
}: {
  brands: ClientLogo[];
  layout?: "directory" | "featured";
}) {
  if (!brands.length) return null;

  return (
    <ul
      className={`${styles.grid} ${layout === "featured" ? styles.featured : ""}`}
      aria-label="Client logos"
    >
      {brands.map((brand) => (
        <li
          key={brand.id}
          className={`${styles.tile} ${"colorImageUrl" in brand && brand.colorImageUrl ? styles.tileWithColor : ""}`}
        >
          <span className={styles.logoFrame}>
            <Image
              src={brand.image.url}
              alt={brand.name}
              width={brand.image.width ?? 240}
              height={brand.image.height ?? 120}
              sizes="(max-width: 639px) 42vw, (max-width: 1023px) 28vw, 16vw"
              className={styles.logo}
              unoptimized={isLocalWordPressMediaUrl(brand.image.url)}
            />
            {"colorImageUrl" in brand && brand.colorImageUrl && (
              <Image
                src={brand.colorImageUrl}
                alt=""
                aria-hidden="true"
                width={brand.image.width ?? 240}
                height={brand.image.height ?? 120}
                sizes="(max-width: 639px) 42vw, (max-width: 1023px) 28vw, 16vw"
                className={styles.colorLogo}
                unoptimized={isLocalWordPressMediaUrl(brand.colorImageUrl)}
              />
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
