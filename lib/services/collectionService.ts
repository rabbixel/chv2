import { collections } from "@/data/collections";
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

let cached: CollectionService | null = null;

export function getCollectionService(): CollectionService {
  // Collections are editorial data here; the directory itself comes from the
  // WordPress Pages API. There is no catalogue collections route to request.
  cached ??= new MockCollectionService();
  return cached;
}
