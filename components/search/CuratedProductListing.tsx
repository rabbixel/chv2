import { Breadcrumbs, Container } from "@/components/layout";
import { ProductGrid } from "@/components/product";
import { PAGINATION } from "@/lib/constants";
import { routes } from "@/lib/routes";
import type { SearchSortKey } from "@/lib/types";
import { getSearchService } from "@/lib/services";
import styles from "./CuratedProductListing.module.css";

export interface CuratedProductListingProps {
  title: string;
  description: string;
  pathname: string;
  sort: SearchSortKey;
  freeOnly?: boolean;
  paidOnly?: boolean;
  page?: number;
}

export async function CuratedProductListing({
  title,
  description,
  pathname,
  sort,
  freeOnly = false,
  paidOnly = false,
  page = 1,
}: CuratedProductListingProps) {
  const result = await getSearchService().searchProducts({
    query: "",
    filters: freeOnly ? { availability: "free" } : paidOnly ? { availability: "paid" } : undefined,
    sort,
    page,
    pageSize: PAGINATION.defaultPageSize,
  });

  return (
    <Container>
      <div className={styles.page}>
        <Breadcrumbs items={[{ label: "Home", href: routes.home() }, { label: title }]} />
        <header className={styles.header}>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        <ProductGrid
          products={result.items}
          totalItems={result.pagination.totalItems}
          cardTitleAs="h2"
          masonry
          empty={{
            title: freeOnly ? "No free downloads found" : paidOnly ? "No paid products found" : "No products found",
            description: "Please check back later or browse all categories.",
          }}
          pagination={{
            page: result.pagination.page,
            totalPages: result.pagination.totalPages,
            buildHref: (nextPage) => nextPage === 1 ? pathname : `${pathname}?page=${nextPage}`,
          }}
        />
      </div>
    </Container>
  );
}
