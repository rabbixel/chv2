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
  checkoutPay: (orderId: string) => `/checkout/pay/${orderId}`,
  checkoutSuccess: (orderId: string) => `/checkout/success/${orderId}`,
  checkoutFailed: (orderId: string) => `/checkout/failed/${orderId}`,
  account: () => "/account",
  accountProfile: () => "/account/profile",
  accountOrders: () => "/account/orders",
  accountOrder: (id: string) => `/account/orders/${encodeURIComponent(id)}`,
  accountDownloads: () => "/account/downloads",
  accountWishlist: () => "/account/wishlist",
  accountLicenses: () => "/account/licenses",
  accountSettings: () => "/account/settings",
  login: (next?: string) =>
    next ? `/login?next=${encodeURIComponent(next)}` : "/login",
  register: (next?: string) =>
    next ? `/register?next=${encodeURIComponent(next)}` : "/register",
  forgotPassword: () => "/forgot-password",
  resetPassword: (token?: string) =>
    token
      ? `/reset-password?token=${encodeURIComponent(token)}`
      : "/reset-password",
  contact: () => "/contact",
  help: () => "/help",
  faqs: () => "/faqs",
  refundPolicy: () => "/refund-policy",
  about: () => "/about",
  terms: () => "/terms",
  privacy: () => "/privacy",
} as const;
