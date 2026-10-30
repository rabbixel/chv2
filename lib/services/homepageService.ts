import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type {
  ChApiEnvelope,
  ChApiHomepageSections,
  ChApiImage,
} from "@/lib/creative-hatti/types";
import type {
  CardArtworkVariant,
  Collection,
  HomepageCharacterCategory,
  ProductImage,
} from "@/lib/types";
import { routes } from "@/lib/routes";
import { cacheTags, REVALIDATE_SECONDS } from "@/lib/cache";
import { frontendCategorySlug } from "@/lib/creative-hatti/adapters";
import { normalizeWordPressMediaUrl } from "@/lib/creative-hatti/media";
import type { DiscoveryTile } from "@/lib/homepage";
import { defaultHomepageContent } from "@/lib/homepageContent";
import { getSeasonalSearches, type SearchChip } from "@/lib/seasonal-searches";
import { getProductService } from "./productService";
import { getCollectionDirectoryService } from "./collectionDirectoryService";
import { resolveHomepageHero, type HomepageHeroConfig, type HomepageHeroOverride } from "@/lib/homepage-config";

export interface TrustedBrand { id: string; name: string; image: ProductImage }

export interface HomepageSections {
  hero: HomepageHeroConfig<ProductImage>;
  characterCategories: HomepageCharacterCategory[] | null;
  featuredPacks: Collection[] | null;
  discoveryTiles: DiscoveryTile[];
  seasonalCollections: Collection[];
  keywords: string[];
  trustedBrands: TrustedBrand[];
}

export interface HomepageService {
  getSections(): Promise<HomepageSections>;
  getPopularSearches(now?: Date): Promise<SearchChip[]>;
}

async function updateDiscoveryDestinations(sections: HomepageSections): Promise<HomepageSections> {
  const hasCharacters = sections.discoveryTiles.some((tile) => tile.icon === "characters" || tile.label === "Characters");
  const hasCollections = sections.discoveryTiles.some((tile) => tile.icon === "cards" || tile.label === "Cards" || tile.label === "Browse all Collections");
  const [character, collectionImage] = await Promise.all([
    hasCharacters ? getProductService().getProductBySlug("indian-woman-is-with-greet-hands") : null,
    hasCollections ? getCollectionDirectoryService().getPreview() : undefined,
  ]);
  let characterImage = character?.images.find((image) => image.url);
  if (hasCharacters && !characterImage) {
    const result = await getProductService().listProducts({ categorySlug: "illustrations", pageSize: 1 });
    characterImage = result.items[0]?.images.find((image) => image.url);
  }
  return { ...sections, discoveryTiles: sections.discoveryTiles.map((tile) => {
    if (tile.icon === "characters" || tile.label === "Characters") {
      return { ...tile, href: routes.illustrations(), image: tile.image ?? characterImage };
    }
    if (tile.icon === "cards" || tile.label === "Cards" || tile.label === "Browse all Collections") {
      return { ...tile, label: tile.label || "Browse all Collections", caption: tile.caption || "Festival, seasonal & themed graphics",
        href: tile.href ?? routes.collections(), image: tile.image ?? collectionImage };
    }
    return tile;
  }) };
}

function imageFromApi(image?: ChApiImage | null): ProductImage | undefined {
  if (!image?.url) return undefined;
  const originalUrl = image.original_url ?? image.url;
  return {
    id: String(image.id),
    url: normalizeWordPressMediaUrl(originalUrl),
    alt: image.alt ?? "",
    width: image.width,
    height: image.height,
    originalUrl: normalizeWordPressMediaUrl(originalUrl),
  };
}

function artworkVariant(value: string): CardArtworkVariant {
  const allowed: CardArtworkVariant[] = [
    "mythology",
    "profession",
    "cultural",
    "festival",
    "shivratri",
    "republic-day",
    "vasant-panchami",
    "valentine",
    "navratri",
  ];
  return allowed.includes(value as CardArtworkVariant)
    ? (value as CardArtworkVariant)
    : "festival";
}

class MockHomepageService implements HomepageService {
  async getPopularSearches(now?: Date): Promise<SearchChip[]> {
    return getSeasonalSearches(now);
  }
  async getSections(): Promise<HomepageSections> {
    return updateDiscoveryDestinations({ hero: resolveHomepageHero<ProductImage>(), characterCategories: null, featuredPacks: null, ...defaultHomepageContent() });
  }
}

class ApiHomepageService implements HomepageService {
  async getPopularSearches(now?: Date): Promise<SearchChip[]> {
    // Future WordPress adapter supplies events/manual/featured to this selector.
    // No new endpoint or backend contract is needed for the local calendar phase.
    return getSeasonalSearches(now);
  }
  async getSections(): Promise<HomepageSections> {
    let response: ChApiEnvelope<ChApiHomepageSections>;
    try {
      response = await apiFetch(apiEndpoints.homepageSections, {
        // WordPress editors expect saved homepage image changes to show up
        // immediately while running the storefront locally. Keep production
        // ISR caching, but bypass the Next.js data cache in development.
        ...(process.env.NODE_ENV === "development"
          ? { cache: "no-store" as const }
          : { revalidate: REVALIDATE_SECONDS.homepage }),
        tags: [cacheTags.homepage],
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return new MockHomepageService().getSections();
      throw error;
    }

    const defaults = defaultHomepageContent();
    const rawHero = response.data.homepage_config_v2?.hero;
    const heroOverride: HomepageHeroOverride<ProductImage> | undefined = rawHero ? {
      ...rawHero,
      images: rawHero.images.map((item) => ({ ...item, image: imageFromApi(item.image) ?? null })),
    } : undefined;
    const destination = (item: { category_slug?: string; query: string; url?: string; icon?: string }) => item.url || (item.icon === "cards"
      ? routes.collections() : item.category_slug
      ? routes.category(frontendCategorySlug(item.category_slug)) : routes.search(item.query));
    return updateDiscoveryDestinations({
      hero: resolveHomepageHero(heroOverride),
      discoveryTiles: response.data.discovery_tiles?.slice(0, 12).map((item) => ({
        label: item.title, caption: item.caption ?? "", query: item.query,
        hue: item.hue ?? 150, icon: item.icon, image: imageFromApi(item.image), href: destination(item),
      })) ?? defaults.discoveryTiles,
      seasonalCollections: response.data.seasonal_collections?.slice(0, 10).map((item, index) => ({
        id: item.id, slug: item.query.replaceAll(" ", "-"), title: item.title,
        tagline: "", query: item.query, hue: item.hue ?? 150,
        kind: "seasonal" as const, sortOrder: index, href: destination(item), coverImage: imageFromApi(item.image),
      })) ?? defaults.seasonalCollections,
      keywords: response.data.keywords?.slice(0, 30) ?? defaults.keywords,
      trustedBrands: (response.data.trusted_brands ?? []).slice(0, 30).flatMap((item) => {
        const image = imageFromApi(item.image);
        return image ? [{ id: String(item.id), name: item.name, image }] : [];
      }),
      characterCategories: response.data.character_categories_enabled
        ? response.data.character_categories.map((item) => ({
            name: item.name,
            blurb: item.blurb,
            query: item.query,
            categorySlug: frontendCategorySlug(item.category_slug),
            hue: item.hue,
            artwork: artworkVariant(item.artwork),
            count: item.count,
            image: imageFromApi(item.image),
          }))
        : null,
      featuredPacks: response.data.featured_packs_enabled
        ? response.data.featured_packs.map((item) => ({
            id: item.id,
            slug: item.slug,
            title: item.title,
            tagline: item.tagline,
            query: item.query,
            hue: item.hue,
            kind: item.kind,
            featured: item.featured,
            sortOrder: item.sort_order,
            categorySlug: item.category_slug ? frontendCategorySlug(item.category_slug) : undefined,
            href: item.url || (item.category_slug
              ? routes.category(frontendCategorySlug(item.category_slug))
              : routes.search(item.query)),
            coverImage: imageFromApi(item.image),
            artwork: artworkVariant(item.artwork),
          }))
        : null,
    });
  }
}

let cached: HomepageService | null = null;

export function getHomepageService(): HomepageService {
  cached ??=
    process.env.USE_MOCK_API !== "true" && process.env.CH_API_URL
      ? new ApiHomepageService()
      : new MockHomepageService();
  return cached;
}
