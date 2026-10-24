/**
 * Single source of truth for storefront URLs.
 * Components must build links through these helpers — never hardcode paths.
 *
 * Keep internal navigation paths centralized here so page links and
 * redirects share the same route definitions.
 */

export const routes = {
  home: () => "/",
  search: (query?: string) =>
    query ? `/search?q=${encodeURIComponent(query)}` : "/search",
  categories: () => "/categories",
  category: (slug: string) => `/category/${slug}`,
  illustrations: () => "/illustrations",
  collections: () => "/collections",
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
  accountOrders: () => "/account/orders",
  accountOrder: (id: string) => `/account/orders/${encodeURIComponent(id)}`,
  accountOrderReceipt: (id: string) => `/account/orders/${encodeURIComponent(id)}/receipt`,
  accountDownloads: () => "/account/downloads",
  accountProfile: () => "/account/profile",
  accountWishlist: () => "/account/wishlist",
  accountLicenses: () => "/account/licenses",
  accountSettings: () => "/account/settings",
  login: (next?: string) =>
    next ? `/login?next=${encodeURIComponent(next)}` : "/login",
  register: (next?: string) =>
    next ? `/register?next=${encodeURIComponent(next)}` : "/register",
  forgotPassword: () => "/forgot-password",
  verifyEmail: () => "/verify-email",
  claimAccount: () => "/claim-account",
  claimVerify: () => "/claim-account/verify",
  resetPassword: () => "/reset-password",
  contact: () => "/contact",
  contactEmail: (subject?: string) =>
    `mailto:hello@creativehatti.com${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`,
  help: () => "/help",
  faqs: () => "/faqs",
  refundPolicy: () => "/refund-policy",
  about: () => "/about",
  terms: () => "/terms",
  privacy: () => "/privacy",
  licenseInformation: () => "/licensing",
} as const;
