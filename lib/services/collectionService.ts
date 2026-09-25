import { collections } from "@/data/collections";
import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { cacheTags, REVALIDATE_SECONDS } from "@/lib/cache";
import type { Collection, Slug } from "@/lib/types";

export interface CollectionService {
  listCollections(): Promise<Collection[]>;
  getCollectionBySlug(slug: Slug): Promise<Collection | null>;
  listFeaturedPacks(): Promise<Collection[]>;
  listSeasonal(): Promise<Collection[]>;
}

class MockCollectionService implements CollectionService {
  async listCollections(): Promise<Collection[]> {
    return [...collections].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getCollectionBySlug(slug: Slug): Promise<Collection | null> {
    const all = await this.listCollections();
    return all.find((collection) => collection.slug === slug) ?? null;
  }

  async listFeaturedPacks(): Promise<Collection[]> {
    return (await this.listCollections()).filter(
      (collection) => collection.featured,
    );
  }

  async listSeasonal(): Promise<Collection[]> {
    return (await this.listCollections()).filter(
      (collection) => collection.seasonal,
    );
  }
}

class ApiCollectionService implements CollectionService {
  async listCollections(): Promise<Collection[]> {
    return apiFetch<Collection[]>(apiEndpoints.collections.list, {
      revalidate: REVALIDATE_SECONDS.catalog,
      tags: [cacheTags.categories],
    });
  }

  async getCollectionBySlug(slug: Slug): Promise<Collection | null> {
    try {
      return await apiFetch<Collection>(apiEndpoints.collections.detail(slug), {
        revalidate: REVALIDATE_SECONDS.catalog,
        tags: [cacheTags.categories],
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  async listFeaturedPacks(): Promise<Collection[]> {
    const all = await this.listCollections();
    return all.filter((collection) => collection.featured);
  }

  async listSeasonal(): Promise<Collection[]> {
    const all = await this.listCollections();
    return all.filter((collection) => collection.seasonal);
  }
}

let cached: CollectionService | null = null;

export function getCollectionService(): CollectionService {
  cached ??=
    process.env.USE_MOCK_API === "false"
      ? new ApiCollectionService()
      : new MockCollectionService();
  return cached;
}
