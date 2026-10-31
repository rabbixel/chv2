import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumbs, Container } from "@/components/layout";
import { routes } from "@/lib/routes";
import { GalleryFilters, GalleryPreview, SearchPagination, type GalleryCategoryOption } from "@/components/gallery-preview";
import { ActiveFilters, NoResults } from "@/components/search";
import { getCollectionService, getSearchService } from "@/lib/services";
import { buildListingHref, parseListingParams, withListingPatch } from "@/lib/search-params";
import { PAGINATION } from "@/lib/constants";
import { popularSearches } from "@/lib/navigation";
import { categoryDisplayName, parentGroupSlug, productGroups } from "@/lib/taxonomy";
import styles from "./page.module.css";

interface SearchPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const params = parseListingParams((await searchParams) ?? {});
  return {
    title: params.q ? `Results for “${params.q}”` : "Search all assets",
    // High-cardinality query URLs stay out of the index; discovery happens through categories, collections and products.
    robots: { index: false, follow: true },
  };
}

/** Search remains URL-driven and server-rendered; only the current page reaches the browser. */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = (await searchParams) ?? {};
  const listing = parseListingParams(query);
  const page = Math.min(listing.page, 50_000);
  const [result, collections] = await Promise.all([
    getSearchService().searchProducts({
      query: listing.q,
      filters: {
        ...(listing.groups.length ? { groups: listing.groups } : {}),
        ...(listing.cats.length ? { categorySlugs: listing.cats } : {}),
        ...(listing.min !== undefined ? { priceMin: listing.min * 100 } : {}),
        ...(listing.max !== undefined ? { priceMax: listing.max * 100 } : {}),
        ...(listing.avail ? { availability: listing.avail } : {}),
        ...(listing.files.length ? { fileTypes: listing.files } : {}),
        ...(listing.apps.length ? { compatibleWith: listing.apps } : {}),
        ...(listing.collection ? { collection: listing.collection } : {}),
        ...(listing.orientation && listing.orientation !== "all" ? { orientation: listing.orientation } : {}),
      },
      sort: listing.sort,
      page,
      pageSize: PAGINATION.defaultPageSize,
    }),
    getCollectionService().listCollections(),
  ]);

  const categoryFacet = result.facets.find((facet) => facet.key === "category")?.values ?? [];
  const categoryOptions: GalleryCategoryOption[] = categoryFacet.map((entry) => ({
    value: entry.value,
    label: entry.label,
    group: productGroups.find((group) => group.slug === parentGroupSlug(entry.value))?.name ?? "Category",
    count: entry.count,
  }));
  for (const selected of listing.cats) {
    if (!categoryOptions.some((option) => option.value === selected)) {
      categoryOptions.push({ value: selected, label: categoryDisplayName(selected), group: productGroups.find((group) => group.slug === parentGroupSlug(selected))?.name ?? "Category" });
    }
  }
  categoryOptions.sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));

  if (result.pagination.totalItems > 0 && result.pagination.totalPages > 0 && listing.page > result.pagination.totalPages) {
    redirect(buildListingHref(routes.search(), withListingPatch(listing, { page: result.pagination.totalPages })));
  }

  const clearHref = buildListingHref(routes.search(), withListingPatch(listing, {
    groups: [], cats: [], min: undefined, max: undefined, avail: undefined,
    files: [], apps: [], collection: undefined, orientation: "all",
  }));
  const { items, pagination } = result;

  return (
    <Container size="wide">
      <div className={styles.page}>
        <Breadcrumbs items={[{ label: "Home", href: routes.home() }, { label: listing.q ? `Search: ${listing.q}` : "Search" }]} />
        <header className={styles.header}>
          <h1 className={styles.title}>{listing.q ? <>Results for <q className={styles.query}>{listing.q}</q></> : "Browse all assets"}</h1>
          <p className={styles.sub} role="status">{pagination.totalItems} {pagination.totalItems === 1 ? "result" : "results"}{result.tookMs !== undefined && <span className={styles.took}> · {result.tookMs} ms</span>}</p>
        </header>

        <GalleryFilters
          action={routes.search()}
          mode="search"
          query={listing.q}
          category="all"
          selectedCategories={listing.cats}
          categories={categoryOptions}
          price={listing.avail ?? "all"}
          orientation={listing.orientation ?? "all"}
          sort={listing.sort}
          density={listing.density ?? "comfortable"}
          overlay={listing.overlay ?? "hover"}
          clearHref={clearHref}
          groups={listing.groups}
          minPrice={listing.min}
          maxPrice={listing.max}
          files={listing.files}
          apps={listing.apps}
          collection={listing.collection}
          collections={collections.map(({ slug, title }) => ({ slug, title }))}
        />

        <ActiveFilters params={listing} collections={collections} />

        {items.length === 0 ? (
          <NoResults query={listing.q} popularSearches={popularSearches} collections={collections} />
        ) : (
          <>
            <p className={styles.count} id="search-results" role="status">Showing {items.length} of {pagination.totalItems} products · page {pagination.page} of {pagination.totalPages}</p>
            <GalleryPreview products={items} density={listing.density ?? "comfortable"} overlayMode={listing.overlay ?? "hover"} returnTo={buildListingHref(routes.search(), listing)} />
            <SearchPagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              hrefBase={buildListingHref(routes.search(), withListingPatch(listing, { page: 1 }))}
              label="Search result pages"
            />
          </>
        )}
      </div>
    </Container>
  );
}
