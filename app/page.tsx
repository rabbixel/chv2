import type { Metadata } from "next";
import { Container } from "@/components/layout";
import { JsonLd } from "@/components/seo";
import {
  CharacterCategories,
  DiscoveryGrid,
  FeaturedPacks,
  HattiChoice,
  Hero,
  PopularSearches,
  SeasonalCollections,
  TrendingKeywords,
  TrustedBy,
  type CharacterCategoryWithCount,
} from "@/components/home";
import {
  characterCategories,
  discoveryTiles,
  trendingKeywords,
} from "@/lib/homepage";
import { SITE } from "@/lib/constants";
import { popularSearches } from "@/lib/navigation";
import { organizationJsonLd } from "@/lib/seo";
import {
  getCategoryService,
  getCollectionService,
  getProductService,
  getSearchService,
} from "@/lib/services";
import styles from "./page.module.css";

// Matches REVALIDATE_SECONDS.static in lib/cache.ts (segment
// configs must be literals — keep the two in sync).
export const revalidate = 86400;

export const metadata: Metadata = {
  alternates: { canonical: SITE.url },
  openGraph: { url: SITE.url },
};

/**
 * Creative Hatti homepage — Indian vector marketplace discovery.
 * Server-rendered; every section is data-driven (services + homepage
 * content config), and every tile links to a working search query.
 */
export default async function HomePage() {
  const searchService = getSearchService();
  const mainPromise = Promise.all([
    getProductService().listFeaturedProducts(8),
    getCategoryService().listCategories(),
    getCollectionService().listFeaturedPacks(),
    getCollectionService().listSeasonal(),
  ]);
  const countsPromise = Promise.all(
    characterCategories.map((category) =>
      searchService.searchProducts({ query: category.query, pageSize: 1 }),
    ),
  );
  const [choice, categories, packs, seasonal] = await mainPromise;
  const countResults = await countsPromise;

  const characters: CharacterCategoryWithCount[] = characterCategories.map(
    (category, index) => ({
      ...category,
      count: countResults[index].pagination.totalItems,
    }),
  );
  const navCategories = categories.map((category) => ({
    name: category.name,
    slug: category.slug,
  }));

  return (
    <>
      <Hero categories={navCategories} popularSearches={popularSearches} />
      <PopularSearches searches={popularSearches} />

      <Container>
        <div className={styles.section}>
          <DiscoveryGrid tiles={discoveryTiles} />
        </div>
      </Container>

      <div className={styles.band}>
        <Container>
          <div className={styles.section}>
            <HattiChoice products={choice} />
          </div>
        </Container>
      </div>

      <Container>
        <div className={styles.section}>
          <CharacterCategories categories={characters} />
        </div>
      </Container>

      <div className={styles.band}>
        <Container>
          <div className={styles.section}>
            <FeaturedPacks packs={packs} />
          </div>
        </Container>
      </div>

      <Container>
        <div className={styles.section}>
          <SeasonalCollections items={seasonal} />
        </div>
        <div className={`${styles.section} ${styles.tight}`}>
          <TrendingKeywords keywords={trendingKeywords} />
        </div>
        <div className={`${styles.section} ${styles.tight}`}>
          <TrustedBy />
        </div>
      </Container>
      <JsonLd data={organizationJsonLd()} />
    </>
  );
}
