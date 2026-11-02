import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { REVALIDATE_SECONDS, cacheTags } from "@/lib/cache";
import type { ChApiEnvelope, ChApiPagination, ChApiProductCard, ChApiSeo } from "@/lib/creative-hatti/types";
import { isLiveApiEnabled } from "./apiMode";

const PAGE_SIZE = 24;
export interface TagArchive {
  tag: { id: number; name: string; slug: string; description?: string; count: number; seo?: ChApiSeo };
  products: ChApiProductCard[];
  pagination: ChApiPagination;
}

export interface TagService {
  getArchive(slug: string, page: number): Promise<TagArchive | null>;
}

// No keyword approximation: mock mode has no real EDD tag membership.
class MockTagService implements TagService {
  async getArchive(): Promise<TagArchive | null> { return null; }
}

class ApiTagService implements TagService {
  async getArchive(slug: string, page: number): Promise<TagArchive | null> {
    if (!/^[a-z0-9_-]+$/i.test(slug)) return null;
    try {
      const response = await apiFetch<ChApiEnvelope<TagArchive>>(
        apiEndpoints.tags.detail(slug),
        {
          searchParams: { page, per_page: PAGE_SIZE },
          revalidate: REVALIDATE_SECONDS.catalog,
          tags: [cacheTags.products],
        },
      );
      return response.data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

}

let cached: TagService | null = null;
export function getTagService(): TagService {
  cached ??= isLiveApiEnabled() ? new ApiTagService() : new MockTagService();
  return cached;
}
