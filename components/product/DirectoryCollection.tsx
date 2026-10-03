import { notFound } from "next/navigation";
import { Breadcrumbs, Container } from "@/components/layout";
import { getCollectionDirectoryService } from "@/lib/services";
import { routes } from "@/lib/routes";
import { ProductGrid } from "./ProductGrid";
import styles from "@/components/search/ListingPage.module.css";

export async function DirectoryCollection({ slug, page }: { slug: string; page: number }) {
  const service = getCollectionDirectoryService();
  const entry = await service.getEntry(slug);
  if (!entry) notFound();
  const result = await service.listProducts(slug, page);
  return <Container><div className={styles.page}>
    <Breadcrumbs items={[{ label: "Home", href: routes.home() }, { label: "Collections", href: routes.collections() }, { label: entry.title }]} />
    <h1>{entry.title}</h1>
    <p className={styles.sub}>{result.total.toLocaleString("en-IN")} matching assets</p>
    <ProductGrid products={result.products} cardTitleAs="h2" artworkPreview
      pagination={{ page, totalPages: result.totalPages, buildHref: (p) => `${routes.collection(slug)}?page=${p}` }} />
  </div></Container>;
}
