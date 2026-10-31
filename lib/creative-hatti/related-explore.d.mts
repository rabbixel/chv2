import type { Category, Collection, Product } from "@/lib/types";

export function selectRelatedCollections(
  product: Product,
  collections: Collection[],
  limit?: number,
  excludedSlugs?: string[],
): Collection[];

export function selectRelatedCategories(
  productCategorySlugs: string[],
  categories: Category[],
  limit?: number,
  excludedSlugs?: string[],
): Category[];
