import { categories } from "@/data/categories";
import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { cacheTags, REVALIDATE_SECONDS } from "@/lib/cache";
import { categoryFromApi } from "@/lib/creative-hatti/adapters";
import type {
  ChApiCategory,
  ChApiEnvelope,
} from "@/lib/creative-hatti/types";
import type { Category, Slug } from "@/lib/types";

export interface CategoryService {
  listCategories(): Promise<Category[]>;
  getCategoryBySlug(slug: Slug): Promise<Category | null>;
  listFeaturedCategories(): Promise<Category[]>;
}

class MockCategoryService implements CategoryService {
  async listCategories(): Promise<Category[]> {
    return [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getCategoryBySlug(slug: Slug): Promise<Category | null> {
    return categories.find((category) => category.slug === slug) ?? null;
  }

  async listFeaturedCategories(): Promise<Category[]> {
    return (await this.listCategories()).filter(
      (category) => category.featured,
    );
  }
}

class ApiCategoryService implements CategoryService {
  async listCategories(): Promise<Category[]> {
    const result = await apiFetch<ChApiEnvelope<ChApiCategory[]>>(
      apiEndpoints.categories.list,
      {
        revalidate: REVALIDATE_SECONDS.catalog,
        tags: [cacheTags.categories],
      },
    );
    return result.data.map(categoryFromApi);
  }

  async getCategoryBySlug(slug: Slug): Promise<Category | null> {
    const all = await this.listCategories();
    return all.find((category) => category.slug === slug) ?? null;
  }

  async listFeaturedCategories(): Promise<Category[]> {
    const all = await this.listCategories();
    return all.filter((category) => category.featured);
  }
}

let cached: CategoryService | null = null;

export function getCategoryService(): CategoryService {
  cached ??=
    process.env.USE_MOCK_API !== "true" && process.env.CH_API_URL
      ? new ApiCategoryService()
      : new MockCategoryService();
  return cached;
}
