import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, Container } from "@/components/layout";
import { ProductImage } from "@/components/product";
import { getCollectionDirectoryService } from "@/lib/services";
import { routes } from "@/lib/routes";
import { SITE } from "@/lib/constants";
import styles from "./page.module.css";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Collections",
  description: "Browse Creative Hatti’s complete collection of festival, seasonal and everyday graphics.",
  alternates: { canonical: `${SITE.url}${routes.collections()}` },
};

export default async function CollectionsPage() {
  const entries = await getCollectionDirectoryService().listEntries();
  return <Container><div className={styles.page}>
    <Breadcrumbs items={[{ label: "Home", href: routes.home() }, { label: "Collections" }]} />
    <header className={styles.heading}><h1>Browse all Collections</h1></header>
    <ul className={styles.grid}>
      {entries.map((entry, index) => <li key={`${entry.slug}-${index}`}>
        <Link href={entry.href ?? routes.collection(entry.slug)} className={styles.card}>
          <span className={styles.preview}>
            {entry.image && <ProductImage image={entry.image} title={entry.title} decorative
              sizes="(max-width: 639px) 50vw, (max-width: 1023px) 25vw, 16vw" className={styles.image} />}
          </span>
          <span className={styles.title}>{entry.title}</span>
          {entry.countLabel && <span className={styles.count}>{entry.countLabel}</span>}
        </Link>
      </li>)}
    </ul>
  </div></Container>;
}
