import type { ID, Slug } from "./common";

export interface Category {
  id: ID;
  slug: Slug;
  name: string;
  description?: string;
  /** Optional editorial/cover image. */
  imageUrl?: string;
  /** Null for top-level categories. */
  parentId: ID | null;
  /** Denormalised count used for navigation (from the search index). */
  productCount: number;
  featured: boolean;
  sortOrder: number;
}
