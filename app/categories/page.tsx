import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, Container } from "@/components/layout";
import { Card } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getCategoryService } from "@/lib/services";
import type { Category } from "@/lib/types";
import styles from "./page.module.css";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "All categories",
  description: "Browse Creative Hatti digital graphics, vectors, illustrations, templates and design categories.",
  alternates: { canonical: `${SITE.url}${routes.categories()}` },
};

export default async function CategoriesPage() {
  const categories = await getCategoryService().listCategories();
  const roots = categories.filter((category) => category.parentId === null);
  const childrenByParent = new Map<string, Category[]>();
  for (const category of categories) {
    if (category.parentId === null) continue;
    const key = String(category.parentId);
    childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), category]);
  }

  return (
    <Container>
      <div className={styles.page}>
        <Breadcrumbs items={[{ label: "Home", href: routes.home() }, { label: "All categories" }]} />
        <header className={styles.header}>
          <h1>All categories</h1>
          <p>Explore digital artwork and design resources by category.</p>
        </header>
        <ul className={styles.grid}>
          {roots.map((category) => (
            <li key={category.id}>
              <Card className={styles.card}>
                <h2><Link href={routes.category(category.slug)}>{category.name}</Link></h2>
                {category.description && <p>{category.description}</p>}
                <p className={styles.count}>{category.productCount.toLocaleString("en-IN")} products</p>
                {(childrenByParent.get(String(category.id)) ?? []).length > 0 && (
                  <ul className={styles.subcategories}>
                    {(childrenByParent.get(String(category.id)) ?? []).map((child) => (
                      <li key={child.id}><Link href={routes.category(child.slug)}>{child.name}</Link></li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}
