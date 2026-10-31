import type { Metadata } from "next";
import { connection } from "next/server";
import { Container } from "@/components/layout";
import { JsonLd } from "@/components/seo";
import {
  CharacterCategories,
  DiscoveryGrid,
  FeaturedPacks,
  HattiChoice,
  Hero,
  PopularFreebies,
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
  // Keep cached catalogue content, but refresh purchase state for each visit.
  await connection();
  const mainPromise = Promise.all([
    getCategoryService().listCategories(),
    getCollectionService().listFeaturedPacks(),
    getHomepageService().getSections(),
    getHomepageService().getPopularSearches(),
  ]);
  const [categories, packs, homepageSections, popularSearches] = await mainPromise;
  const products = getProductService();
  const [choice, popularFreeCharacters] = await Promise.all([
    homepageSections.productSelections.hattiChoice.mode === "manual"
      ? products.getProductsByIds(homepageSections.productSelections.hattiChoice.productIds)
      : products.listFeaturedProducts(8),
    homepageSections.productSelections.popularFreebies.mode === "manual"
      ? products.getProductsByIds(homepageSections.productSelections.popularFreebies.productIds).then((items) =>
          import("@/lib/creative-hatti/popular-free-characters.mjs").then(({ selectPopularFreeCharacters }) =>
            selectPopularFreeCharacters(items.filter((item) => item.isFree), 8),
          ),
        )
      : products.listPopularFreeCharacters(8),
  ]);
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
      <Hero categories={navCategories} popularSearches={popularSearches.map((item) => item.searchQuery)} products={choice} config={homepageSections.hero} />
      {content.copy.popular_searches.visible && <PopularSearches searches={popularSearches} heading={content.copy.popular_searches.heading} />}

      {content.copy.discovery.visible && <Container>
        <div className={styles.section}>
          <DiscoveryGrid tiles={content.discoveryTiles} copy={content.copy.discovery} />
        </div>
      </Container>}

      {content.copy.hatti_choice.visible && <div className={styles.band}>
        <Container>
          <div className={styles.section}>
            <HattiChoice products={choice} copy={content.copy.hatti_choice} />
          </div>
        </Container>
      </div>}

      {content.copy.character_categories.visible && <Container>
        <div className={styles.section}>
          <CharacterCategories categories={characters} copy={content.copy.character_categories} />
        </div>
      </Container>}

      {content.copy.popular_freebies.visible && <Container>
        <div className={styles.section}>
          <PopularFreebies products={popularFreeCharacters} copy={content.copy.popular_freebies} />
        </div>
      </Container>}

      {content.copy.featured_packs.visible && <div className={styles.band}>
        <Container>
          <div className={styles.section}>
            <FeaturedPacks packs={featuredPacks} copy={content.copy.featured_packs} />
          </div>
        </Container>
      </div>}

      <Container>
        {content.copy.seasonal_collections.visible && <div className={styles.section}><SeasonalCollections items={content.seasonalCollections} copy={content.copy.seasonal_collections} /></div>}
        {content.copy.popular_themes.visible && <div className={`${styles.section} ${styles.tight}`}><TrendingKeywords keywords={content.keywords} heading={content.copy.popular_themes.heading} eyebrow={content.copy.popular_themes.eyebrow} description={content.copy.popular_themes.description} /></div>}
        {content.copy.trusted_clients.visible && <div className={`${styles.section} ${styles.tight}`}><TrustedBy brands={content.trustedBrands} copy={content.copy.trusted_clients} /></div>}
      </Container>
      <JsonLd data={organizationJsonLd()} />
    </>
  );
}
