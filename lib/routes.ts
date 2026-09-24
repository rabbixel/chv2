/**
 * Single source of truth for storefront URLs.
 * Components must build links through these helpers — never hardcode paths.
 */

export const routes = {
  home: () => "/",
  search: (query?: string) =>
    query ? `/search?q=${encodeURIComponent(query)}` : "/search",
  category: (slug: string) => `/categories/${slug}`,
  product: (slug: string) => `/products/${slug}`,
  cart: () => "/cart",
  checkout: () => "/checkout",
  wishlist: () => "/wishlist",
  account: () => "/account",
  accountOrders: () => "/account/orders",
  accountDownloads: () => "/account/downloads",
  signIn: () => "/sign-in",
} as const;
