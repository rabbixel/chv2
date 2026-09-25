import { productGroups } from "@/lib/taxonomy";
import type { Category } from "@/lib/types";

/**
 * Category records built from the centralized taxonomy (`lib/taxonomy.ts`).
 * Names and hierarchy come from the taxonomy; only `productCount` mirrors
 * the mock catalogue in `data/products.ts` (the real backend supplies
 * search-index counts).
 */

const MOCK_COUNTS: Record<string, number> = {
  // Groups
  "vector-creatives": 35,
  "character-bundle": 16,
  freebies: 2,
  // Vector Creatives subcategories
  flyers: 3,
  "logo-design": 3,
  "social-media": 6,
  website: 2,
  "t-shirts": 2,
  // Character Bundle subcategories
  cultural: 3,
  "festival-events": 3,
  mythological: 4,
  people: 2,
  profession: 3,
  miscellaneous: 1,
};

function buildCategories(): Category[] {
  const records: Category[] = [];
  let sortOrder = 1;
  for (const group of productGroups) {
    records.push({
      id: `cat-${group.slug}`,
      slug: group.slug,
      name: group.name,
      description: group.description,
      parentId: null,
      productCount: MOCK_COUNTS[group.slug] ?? 0,
      featured: true,
      sortOrder: sortOrder++,
    });
    for (const sub of group.subcategories) {
      records.push({
        id: `cat-${sub.slug}`,
        slug: sub.slug,
        name: sub.name,
        description: sub.description,
        parentId: `cat-${group.slug}`,
        productCount: MOCK_COUNTS[sub.slug] ?? 0,
        featured: false,
        sortOrder: sortOrder++,
      });
    }
  }
  return records;
}

export const categories: Category[] = buildCategories();
