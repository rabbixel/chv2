import { collections } from "@/data/collections";
import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { cacheTags, REVALIDATE_SECONDS } from "@/lib/cache";
import { collectionGridQuery, parseCollectionCards } from "@/lib/creative-hatti/collections";
import { normalizeWordPressMediaUrl } from "@/lib/creative-hatti/media";
import { getProductService } from "./productService";
import { getCategoryService } from "./categoryService";
import { routes } from "@/lib/routes";
import { getSearchService } from "./searchService";
import type { Product, ProductImage } from "@/lib/types";

export interface CollectionDirectoryEntry {
  slug: string;
  title: string;
  image?: ProductImage;
  query?: string;
  countLabel?: string;
  href?: string;
}
export interface CollectionDirectoryService {
  listEntries(): Promise<CollectionDirectoryEntry[]>;
  getPreview(): Promise<ProductImage | undefined>;
  getEntry(slug: string): Promise<CollectionDirectoryEntry | null>;
  listProducts(slug: string, page: number): Promise<{ products: Product[]; totalPages: number; total: number }>;
}
interface WordPressPage { slug: string; content: { rendered: string } }
interface WordPressMedia { id: number; source_url: string; alt_text: string; media_details?: { width?: number; height?: number } }
interface WordPressDownload { slug: string }
const cache = { revalidate: REVALIDATE_SECONDS.catalog, tags: [cacheTags.categories] };

class MockCollectionDirectoryService implements CollectionDirectoryService {
  async listEntries() { return collections.map((c) => ({ slug: c.slug, title: c.title, image: c.coverImage, query: c.query })); }
  async getPreview() { return collections.find((c) => c.coverImage)?.coverImage; }
  async getEntry(slug: string) { return (await this.listEntries()).find((c) => c.slug === slug) ?? null; }
  async listProducts(slug: string, page: number) {
    const entry = await this.getEntry(slug);
    if (!entry) return { products: [], total: 0, totalPages: 0 };
    const result = await getSearchService().searchProducts({ query: entry.query, page, pageSize: 24 });
    return { products: result.items, total: result.pagination.totalItems, totalPages: result.pagination.totalPages };
  }
}

class WordPressCollectionDirectoryService implements CollectionDirectoryService {
  private async cards() {
    const pages = await apiFetch<WordPressPage[]>(apiEndpoints.wordpress.pages, {
      ...cache, wordpress: true, searchParams: { slug: "collections", per_page: 1, _fields: "slug,content" },
    });
    return parseCollectionCards(pages[0]?.content.rendered ?? "");
  }
  private async image(id: number): Promise<WordPressMedia> {
    return apiFetch<WordPressMedia>(apiEndpoints.wordpress.mediaDetail(id), {
      ...cache, wordpress: true, searchParams: { _fields: "id,source_url,alt_text,media_details.width,media_details.height" },
    });
  }
  private productImage(item: WordPressMedia): ProductImage {
    return { id: String(item.id), url: normalizeWordPressMediaUrl(item.source_url), alt: item.alt_text ?? "",
      width: item.media_details?.width, height: item.media_details?.height };
  }
  async getPreview(): Promise<ProductImage | undefined> {
    const card = (await this.cards())[0];
    return card ? this.productImage(await this.image(card.mediaId)) : undefined;
  }
  async listEntries(): Promise<CollectionDirectoryEntry[]> {
    const cards = await this.cards();
    const ids = [...new Set(cards.map((c) => c.mediaId))];
    const media: WordPressMedia[] = [];
    // Individual attachment routes work on the legacy installation; cap concurrency.
    for (let offset = 0; offset < ids.length; offset += 6) {
      media.push(...await Promise.all(ids.slice(offset, offset + 6).map((id) => this.image(id))));
    }
    const categories = await getCategoryService().listCategories();
    return cards.map((card) => {
      const item = media.find((m) => m.id === card.mediaId);
      const category = categories.find((c) => c.slug === card.slug);
      return { slug: card.slug, title: card.title,
        countLabel: category ? `${category.productCount.toLocaleString("en-IN")} Items` : card.countLabel,
        href: category ? routes.category(category.slug) : routes.collection(card.slug), image: item ? this.productImage(item) : undefined };
    });
  }
  async getEntry(slug: string): Promise<CollectionDirectoryEntry | null> {
    const entry = (await this.cards()).find((c) => c.slug === slug);
    if (!entry) return null;
    const pages = await apiFetch<WordPressPage[]>(apiEndpoints.wordpress.pages, {
      ...cache, wordpress: true, searchParams: { slug, per_page: 1, _fields: "slug,content" },
    });
    return { ...entry, query: collectionGridQuery(pages[0]?.content.rendered ?? "") ?? entry.title };
  }
  async listProducts(slug: string, page: number) {
    const entry = await this.getEntry(slug);
    if (!entry?.query) return { products: [], total: 0, totalPages: 0 };
    // The CH API has no keyword parameter. Use the existing public WP REST search
    // for matching slugs, then hydrate only this page through the product accessor.
    let total = 0;
    let totalPages = 0;
    const result = await apiFetch<WordPressDownload[]>(apiEndpoints.wordpress.downloads, {
      ...cache, wordpress: true,
      onPagination: (items, pages) => { total = items; totalPages = pages; },
      searchParams: { search: entry.query, page, per_page: 24, _fields: "slug" },
    });
    const products = await Promise.all(result.map((p) => getProductService().getProductBySlug(p.slug)));
    return { products: products.filter((p): p is Product => p !== null), total, totalPages };
  }
}
let cached: CollectionDirectoryService | null = null;
export function getCollectionDirectoryService(): CollectionDirectoryService {
  return cached ??= process.env.USE_MOCK_API !== "true" && process.env.CH_API_URL
    ? new WordPressCollectionDirectoryService() : new MockCollectionDirectoryService();
}
