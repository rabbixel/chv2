import { collections } from "@/data/collections";
import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { cacheTags, REVALIDATE_SECONDS } from "@/lib/cache";
import type { Collection } from "@/lib/types";

export interface CollectionService {
  listCollections(): Promise<Collection[]>;
  listFeaturedPacks(): Promise<Collection[]>;
  listSeasonal(): Promise<Collection[]>;
}

class MockCollectionService implements CollectionService {
  async listCollections(): Promise<Collection[]> {
    return [...collections].sort((a, b) => a.sortOrder - b.sortOrder);
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
