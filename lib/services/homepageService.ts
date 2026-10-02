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
import type { DiscoveryTile } from "@/lib/homepage";
import { defaultHomepageContent } from "@/lib/homepageContent";
import { getSeasonalSearches, type SearchChip } from "@/lib/seasonal-searches";

export interface TrustedBrand { id: string; name: string; image: ProductImage }

export interface HomepageSections {
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

function imageFromApi(image?: ChApiImage | null): ProductImage | undefined {
  if (!image?.url) return undefined;
  return {
    id: String(image.id),
    url: image.url,
    alt: image.alt ?? "",
    width: image.width,
    height: image.height,
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
    return { characterCategories: null, featuredPacks: null, ...defaultHomepageContent() };
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
        revalidate: REVALIDATE_SECONDS.homepage,
        tags: [cacheTags.homepage],
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return new MockHomepageService().getSections();
      throw error;
    }

    const defaults = defaultHomepageContent();
    const destination = (item: { category_slug?: string; query: string }) => item.category_slug
      ? routes.category(frontendCategorySlug(item.category_slug)) : routes.search(item.query);
    return {
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
            categorySlug: frontendCategorySlug(item.category_slug),
            href: routes.category(frontendCategorySlug(item.category_slug)),
            coverImage: imageFromApi(item.image),
            artwork: artworkVariant(item.artwork),
          }))
        : null,
    };
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
