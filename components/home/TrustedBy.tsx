import { SectionHeading } from "./SectionHeading";
import styles from "./TrustedBy.module.css";
import type { TrustedBrand } from "@/lib/services/homepageService";
import Link from "next/link";
import { ClientLogoGrid } from "@/components/clients";
import { selectFeaturedClientBrands } from "@/lib/creative-hatti/clients";
import { routes } from "@/lib/routes";

export function TrustedBy({ brands }: { brands: TrustedBrand[] }) {
  const featuredBrands = selectFeaturedClientBrands(brands);
  if (!featuredBrands.length) return null;
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
      <ClientLogoGrid brands={featuredBrands} layout="featured" />
      <p className={styles.viewAll}>
        <Link href={routes.trustedBy()}>View All Clients</Link>
      </p>
    </section>
  );
}
