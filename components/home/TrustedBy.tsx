import { SectionHeading } from "./SectionHeading";
import styles from "./TrustedBy.module.css";
import Image from "next/image";
import type { TrustedBrand } from "@/lib/services/homepageService";
import { isLocalWordPressMediaUrl } from "@/lib/creative-hatti/media";

export function TrustedBy({ brands }: { brands: TrustedBrand[] }) {
  if (!brands.length) return null;
  return (
    <section aria-labelledby="trusted-heading">
      <SectionHeading
        eyebrow="Loved across India"
        title="We are trusted by"
        copy="Studios, brands and creators build with Creative Hatti assets every day."
      />
      <h2 id="trusted-heading" className="ch-visually-hidden">
        Trusted by leading brands
      </h2>
      <ul className={styles.grid} aria-label="Trusted clients">
        {brands.map((brand) => (
          <li key={brand.id} className={styles.tile}>
            <Image src={brand.image.url} alt={brand.name} width={brand.image.width ?? 240}
              height={brand.image.height ?? 120} sizes="(max-width: 640px) 40vw, 160px"
              className={styles.logo} unoptimized={isLocalWordPressMediaUrl(brand.image.url)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
