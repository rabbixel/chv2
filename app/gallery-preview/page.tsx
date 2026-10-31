import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout";
import { GalleryFilters, GalleryPreview, SearchPagination, type GalleryCategoryOption } from "@/components/gallery-preview";
import { routes } from "@/lib/routes";
import { getSearchService } from "@/lib/services";
import { categoryDisplayName, parentGroupSlug, productGroups } from "@/lib/taxonomy";
import type { ImageOrientation, Product, SearchSortKey } from "@/lib/types";
import styles from "./page.module.css";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Experimental Gallery Preview",
  description: "A private design prototype for browsing Creative Hatti artwork.",
  robots: { index: false, follow: false, noarchive: true },
};

type Query = Record<string, string | string[] | undefined>;
interface PageProps { searchParams?: Promise<Query> }
type GalleryCategory = "all" | "freebies" | "festival" | "characters";
type Density = "compact" | "comfortable";
type OverlayMode = "hover" | "always";

const sortValues: SearchSortKey[] = ["relevance", "newest", "best-selling", "price-asc", "price-desc"];
const orientations: ImageOrientation[] = ["all", "landscape", "portrait", "square"];

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function listValue(value: string | string[] | undefined): string[] {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function galleryHref({
  query, category, categories, price, orientation, sort, density, overlay,
}: {
  query: string; category: GalleryCategory; categories: string[]; price: "all" | "free" | "paid";
  orientation: ImageOrientation; sort: SearchSortKey; density: Density; overlay: OverlayMode;
}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("category", category);
  if (price !== "all" || category === "freebies") params.set("avail", price);
  for (const slug of categories) params.append("cat", slug);
  if (orientation !== "all") params.set("orientation", orientation);
  if (sort !== "relevance") params.set("sort", sort);
  if (density !== "comfortable") params.set("density", density);
  if (overlay !== "hover") params.set("overlay", overlay);
  const encoded = params.toString();
  return encoded ? `${routes.galleryPreview()}?${encoded}` : routes.galleryPreview();
}

export default async function GalleryPreviewPage({ searchParams }: PageProps) {
  const query = await (searchParams ?? Promise.resolve({} as Query));
  const rawCategory = firstValue(query.category);
  const category: GalleryCategory = rawCategory === "all" || rawCategory === "festival" || rawCategory === "characters" ? rawCategory : "freebies";
  const density: Density = firstValue(query.density) === "compact" ? "compact" : "comfortable";
  const overlay: OverlayMode = firstValue(query.overlay) === "always" ? "always" : "hover";
  const orientationValue = firstValue(query.orientation);
  const orientation: ImageOrientation = orientations.includes(orientationValue as ImageOrientation) ? orientationValue as ImageOrientation : "all";
  const queryText = (firstValue(query.q) ?? "").trim().slice(0, 160);
  const rawPrice = firstValue(query.avail);
  const price: "all" | "free" | "paid" = rawPrice === "free" || rawPrice === "paid" ? rawPrice : rawPrice === "all" ? "all" : category === "freebies" ? "free" : "all";
  const selectedCategories = listValue(query.cat);
  const rawSort = firstValue(query.sort);
  const defaultSort: SearchSortKey = category === "festival" ? "relevance" : "best-selling";
  const sort: SearchSortKey = sortValues.includes(rawSort as SearchSortKey) ? rawSort as SearchSortKey : defaultSort;
  const pageNumber = Number(firstValue(query.page));
  const page = Number.isInteger(pageNumber) && pageNumber > 0 ? Math.min(pageNumber, 50_000) : 1;
  const pageSize = 48;
  const searchText = [queryText, category === "festival" ? "festival" : ""].filter(Boolean).join(" ");

  let products: Product[] = [];
  let pagination: { page: number; totalPages: number; totalItems: number } | null = null;
  let categoryOptions: GalleryCategoryOption[] = [];
  let unavailable = false;
  try {
    const result = await getSearchService().searchProducts({
      query: searchText,
      filters: {
        ...(category === "characters" ? { groups: ["character-bundle"] } : {}),
        ...(price !== "all" ? { availability: price } : {}),
        ...(selectedCategories.length ? { categorySlugs: selectedCategories } : {}),
        orientation,
      },
      sort,
      page,
      pageSize,
    });
    products = result.items;
    pagination = result.pagination;
    const facet = result.facets.find((entry) => entry.key === "category");
    categoryOptions = (facet?.values ?? []).map((entry) => ({
      value: entry.value,
      label: entry.label,
      group: productGroups.find((item) => item.slug === parentGroupSlug(entry.value))?.name ?? "Category",
      count: entry.count,
    }));
    for (const selected of selectedCategories) {
      if (!categoryOptions.some((option) => option.value === selected)) {
        categoryOptions.push({ value: selected, label: categoryDisplayName(selected), group: productGroups.find((item) => item.slug === parentGroupSlug(selected))?.name ?? "Category" });
      }
    }
    categoryOptions.sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  } catch {
    unavailable = true;
  }

  const currentHref = {
    query: queryText, category, categories: selectedCategories, price, orientation, sort, density, overlay,
  };
  if (pagination && pagination.totalItems > 0 && pagination.totalPages > 0 && page > pagination.totalPages) {
    redirect(`${galleryHref(currentHref)}&page=${pagination.totalPages}`);
  }
  const currentPage = pagination?.page ?? page;
  const clearHref = galleryHref({ ...currentHref, category: "all", categories: [], price: "all", orientation: "all" });
  const hasFilters = category !== "all" || price !== "all" || orientation !== "all" || selectedCategories.length > 0;
  const chips = [
    ...(category !== "all" ? [{ label: category === "freebies" ? "Freebies" : category === "festival" ? "Festival graphics" : "Characters", href: galleryHref({ ...currentHref, category: "all", price: category === "freebies" && rawPrice == null ? "all" : price }) }] : []),
    ...(price !== "all" && !(category === "freebies" && rawPrice == null) ? [{ label: price === "free" ? "Free" : "Paid", href: galleryHref({ ...currentHref, price: "all" }) }] : []),
    ...selectedCategories.map((slug) => ({
      label: categoryOptions.find((option) => option.value === slug)?.label ?? categoryDisplayName(slug),
      href: galleryHref({ ...currentHref, categories: selectedCategories.filter((entry) => entry !== slug) }),
    })),
    ...(orientation !== "all" ? [{ label: orientation[0].toUpperCase() + orientation.slice(1), href: galleryHref({ ...currentHref, orientation: "all" }) }] : []),
  ];

  return (
    <Container size="wide">
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Experimental design preview</p>
          <h1>Discover Creative Hatti artwork</h1>
          <p className={styles.intro}>A temporary image-first gallery using real local catalogue products. This preview does not change the existing storefront.</p>
        </header>

        <GalleryFilters
          action={routes.galleryPreview()}
          query={queryText}
          category={category}
          selectedCategories={selectedCategories}
          categories={categoryOptions}
          price={price}
          orientation={orientation}
          sort={sort}
          density={density}
          overlay={overlay}
          clearHref={clearHref}
        />

        {chips.length > 0 && (
          <div className={styles.activeFilters} aria-label="Active filters">
            {chips.map((chip, index) => <Link className={styles.chip} key={`${chip.label}-${index}`} href={chip.href}>{chip.label}<span aria-hidden="true">×</span><span className="ch-visually-hidden"> Remove filter</span></Link>)}
            {hasFilters && <Link className={styles.clearAll} href={clearHref}>Clear all</Link>}
          </div>
        )}

        {unavailable ? (
          <div className={styles.state} role="status"><h2>Gallery temporarily unavailable</h2><p>The product search service did not respond. Try again later; no sample products have been substituted.</p></div>
        ) : products.length === 0 ? (
          <div className={styles.state} role="status"><h2>No artwork found</h2><p>Try changing your search or clearing some filters.</p>{hasFilters && <Link href={clearHref}>Clear all filters</Link>}</div>
        ) : (
          <>
            <p className={styles.count} id="search-results" role="status">Showing {products.length} of {pagination?.totalItems ?? products.length} products · page {currentPage} of {pagination?.totalPages ?? 1}</p>
            <GalleryPreview products={products} density={density} overlayMode={overlay} />
            {pagination && <SearchPagination
              currentPage={currentPage}
              totalPages={pagination.totalPages}
              hrefBase={galleryHref(currentHref)}
              label="Gallery pages"
            />}
          </>
        )}
        <p className={styles.rollback}><Link href={routes.home()}>Return to the Creative Hatti storefront</Link></p>
      </div>
    </Container>
  );
}
