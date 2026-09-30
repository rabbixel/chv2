import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import {
  getCategoryService,
  getCollectionService,
  getProductService,
} from "@/lib/services";

export const revalidate = 86_400;

/**
 * Chunked sitemap architecture for the 44,000+ product catalogue:
 * chunk 0 carries static + taxonomy + collection URLs, chunk 1 carries
 * the latest public products available through the paginated catalogue API.
 *
 * Full product sitemap coverage needs a backend sitemap/index endpoint. The
 * catalogue API intentionally caps pages at 48, so build-time crawling all
 * products would require hundreds of API requests per sitemap generation.
 * Served as `/sitemap/[id].xml` and listed individually in robots.txt
 * (no `/sitemap.xml` index is generated when chunking is enabled).
 */
const PRODUCT_CHUNK_SIZE = 48;
const PRODUCT_PAGE_SIZE = 48;

/** Chunk ids: 0 = static/taxonomy/collections, 1..N = products. Shared with robots.ts. */
export async function sitemapChunkIds(): Promise<number[]> {
  return [0, 1];
}

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  const ids = await sitemapChunkIds();
  return ids.map((id) => ({ id }));
}

async function productChunk(chunk: number): Promise<MetadataRoute.Sitemap> {
  const service = getProductService();
  const start = chunk * PRODUCT_CHUNK_SIZE;
  const firstPage = Math.floor(start / PRODUCT_PAGE_SIZE) + 1;
  const pages = Math.ceil(PRODUCT_CHUNK_SIZE / PRODUCT_PAGE_SIZE);
  const entries: MetadataRoute.Sitemap = [];
  // Batched parallel reads; each page response is fetch-cached.
  for (let batch = 0; batch < pages; batch += 10) {
    const results = await Promise.all(
      Array.from(
        { length: Math.min(10, pages - batch) },
        (_, i) => service.listProducts({ page: firstPage + batch + i, pageSize: PRODUCT_PAGE_SIZE }),
      ),
    );
    for (const result of results) {
      for (const product of result.items) {
        entries.push({
          url: `${SITE.url}${routes.product(product.slug)}`,
          lastModified: product.updatedAt,
          changeFrequency: "weekly",
          priority: 0.8,
        });
        if (entries.length >= PRODUCT_CHUNK_SIZE) return entries;
      }
      if (firstPage + batch >= result.pagination.totalPages) {
        return entries;
      }
    }
  }
  return entries;
}

export default async function sitemap({
  id,
}: {
  // Next 16 passes route params as promises (same as page `params`).
  id: number | Promise<number>;
}): Promise<MetadataRoute.Sitemap> {
  const resolvedId = await id;
  if (resolvedId > 0) return productChunk(resolvedId - 1);

  const [categories, collections] = await Promise.all([
    getCategoryService().listCategories(),
    getCollectionService().listCollections(),
  ]);
  return [
    {
      url: SITE.url,
      changeFrequency: "daily",
      priority: 1,
    },
    ...categories.map((category) => ({
      url: `${SITE.url}${routes.category(category.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...collections.map((collection) => ({
      url: `${SITE.url}${routes.collection(collection.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
