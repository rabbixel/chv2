import { SectionHeading } from "./SectionHeading";
import styles from "./TrustedBy.module.css";
import type { TrustedBrand } from "@/lib/services/homepageService";
import Link from "next/link";
import { routes } from "@/lib/routes";
import { ClientLogoGrid } from "@/components/clients";
import { selectFeaturedClientBrands } from "@/lib/creative-hatti/clients";

export function TrustedBy({ brands, copy }: { brands: TrustedBrand[]; copy?: { eyebrow?: string; heading?: string; description?: string; browse_label?: string; browse_url?: string } }) {
  const featuredBrands = selectFeaturedClientBrands(brands);
  if (!featuredBrands.length) return null;
  return (
    <section aria-labelledby="trusted-heading">
      <div className={styles.header}>
        <SectionHeading
          className={styles.headerContent}
          eyebrow={copy?.eyebrow ?? "Loved across India"}
          title={copy?.heading ?? "We are trusted by"}
          copy={copy?.description ?? "Studios, brands and creators build with Creative Hatti assets every day."}
        />
        {(copy?.browse_url ?? routes.trustedBy()) && (copy?.browse_label ?? "View All Clients") && <p className={styles.viewAll}>
          <Link href={copy?.browse_url ?? routes.trustedBy()}>{copy?.browse_label ?? "View All Clients"}</Link>
        </p>}
      </div>
      <h2 id="trusted-heading" className="ch-visually-hidden">
        Trusted by leading brands
      </h2>
      <ClientLogoGrid brands={featuredBrands} layout="featured" />
    </section>
  );
}
