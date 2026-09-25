/**
 * Single source of truth for storefront URLs.
 * Components must build links through these helpers — never hardcode paths.
 *
 * Placeholder routes (categories index, marketing pages, …) intentionally
 * resolve to future paths; they render the branded 404 until built.
 */

export const routes = {
  home: () => "/",
  search: (query?: string) =>
    query ? `/search?q=${encodeURIComponent(query)}` : "/search",
  categories: () => "/categories",
  category: (slug: string) => `/category/${slug}`,
  collection: (slug: string) => `/collections/${slug}`,
  product: (slug: string) => `/product/${slug}`,
  customize: () => "/get-it-customized",
  newArrivals: () => "/new-arrivals",
  popular: () => "/popular",
  freeDownloads: () => "/free-downloads",
  cart: () => "/cart",
  checkout: () => "/checkout",
  wishlist: () => "/wishlist",
  account: () => "/account",
  accountOrders: () => "/account/orders",
  accountDownloads: () => "/account/downloads",
  signIn: () => "/sign-in",
  contact: () => "/contact",
  help: () => "/help",
  faqs: () => "/faqs",
  refundPolicy: () => "/refund-policy",
  about: () => "/about",
  terms: () => "/terms",
  privacy: () => "/privacy",
} as const;
