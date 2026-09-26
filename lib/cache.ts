/**
 * Caching policy for catalog data.
 *
 * The catalog will hold 44,000+ products, so every read goes through the
 * service layer with explicit revalidation + tags. Mutations (cart,
 * wishlist, orders) never use these cached paths.
 */

export const REVALIDATE_SECONDS = {
  /** Category / listing pages — long-lived, purged on publish. */
  catalog: 3600,
  /** Product detail — purged per product on update. */
  product: 1800,
  /** Search results — short cache, high cardinality. */
  search: 60,
  /** Marketing / static content. */
  static: 86_400,
} as const;

export const cacheTags = {
  products: "products",
  product: (slug: string) => `product:${slug}`,
  categories: "categories",
  categoryProducts: (slug: string) => `category-products:${slug}`,
  search: "search",
  licenses: "licenses",
} as const;
