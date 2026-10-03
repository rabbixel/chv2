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
} from "@/lib/homepage";
import { SITE } from "@/lib/constants";
import { organizationJsonLd } from "@/lib/seo";
import {
  getCategoryService,
  getCollectionService,
  getHomepageService,
  getProductService,
} from "@/lib/services";
import styles from "./page.module.css";

// Refresh date-driven searches even in mock mode; API data may use a shorter TTL.
export const revalidate = 3600;

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
  const mainPromise = Promise.all([
    getProductService().listFeaturedProducts(8),
    getCategoryService().listCategories(),
    getCollectionService().listFeaturedPacks(),
    getHomepageService().getSections(),
    getHomepageService().getPopularSearches(),
  ]);
  const [choice, categories, packs, homepageSections, popularSearches] = await mainPromise;
  const content = homepageSections;

  const categoryCount = (slug: string) =>
    categories.find((entry) => entry.slug === slug)?.productCount ?? 0;
  const characters: CharacterCategoryWithCount[] =
    homepageSections?.characterCategories
      ? homepageSections.characterCategories.map((category) => ({
        ...category,
        count: categoryCount(category.categorySlug) || category.count,
      }))
      : characterCategories.map((category) => ({
          ...category,
          count: categoryCount(category.categorySlug),
        }));
  const featuredPacks = homepageSections?.featuredPacks ?? packs;
  const navCategories = categories.map((category) => ({
    name: category.name,
    slug: category.slug,
  }));

  return (
    <>
      <Hero categories={navCategories} popularSearches={popularSearches.map((item) => item.searchQuery)} products={choice} />
      <PopularSearches searches={popularSearches} />

      <Container>
        <div className={styles.section}>
          <DiscoveryGrid tiles={content.discoveryTiles} />
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
            <FeaturedPacks packs={featuredPacks} />
          </div>
        </Container>
      </div>

      <Container>
        <div className={styles.section}>
          <SeasonalCollections items={content.seasonalCollections} />
        </div>
        <div className={`${styles.section} ${styles.tight}`}>
          <TrendingKeywords keywords={content.keywords} />
        </div>
        <div className={`${styles.section} ${styles.tight}`}>
          <TrustedBy brands={content.trustedBrands} />
        </div>
      </Container>
      <JsonLd data={organizationJsonLd()} />
    </>
  );
}
