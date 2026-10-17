/**
 * Backend route builders. Keeps every API path in one file so the eventual
 * backend contract has a single integration surface.
 */

export const apiEndpoints = {
  wordpress: {
    pages: "/pages",
    media: "/media",
    mediaDetail: (id: number) => `/media/${id}`,
    downloads: "/edd-downloads",
  },
  products: {
    list: "/products",
    byId: (id: string) => `/products/${encodeURIComponent(id)}`,
    detail: (slug: string) => `/products/slug/${encodeURIComponent(slug)}`,
    related: (slug: string) =>
      `/products/slug/${encodeURIComponent(slug)}/related`,
    sitemap: "/products/sitemap",
  },
  categories: {
    list: "/categories",
    detail: (slug: string) => `/categories/${encodeURIComponent(slug)}`,
    products: (slug: string) =>
      `/categories/${encodeURIComponent(slug)}/products`,
  },
  search: "/indexed-search",
  homepageSections: "/homepage-sections",
  collections: {
    list: "/v1/collections",
    detail: (slug: string) => `/v1/collections/${encodeURIComponent(slug)}`,
  },
  licenses: {
    list: "/v1/licenses",
    owned: "/v1/licenses/owned",
  },
  payments: {
    verify: "/v1/payments/verify",
  },
  cart: "/cart/validate",
  wishlist: "/v1/wishlist",
  checkout: "/v1/checkout",
  checkoutQuote: "/checkout/quote",
  checkoutPrepare: "/checkout/prepare",
  orders: {
    list: "/v1/orders",
    detail: (id: string) => `/v1/orders/${encodeURIComponent(id)}`,
  },
  downloads: {
    list: "/v1/downloads",
    fulfil: (id: string) => `/v1/downloads/${encodeURIComponent(id)}/fulfil`,
    requestUrl: "/v1/downloads/request-url",
  },
  customer: {
    me: "/customer/me",
    orders: "/customer/orders",
    order: (id: string) => `/customer/orders/${encodeURIComponent(id)}`,
    orderReceipt: (id: string) => `/customer/orders/${encodeURIComponent(id)}/receipt`,
    downloads: "/customer/downloads",
      licenses: "/customer/licenses",
      profile: "/customer/profile",
    claimRequest: "/customer/claim/request",
    claimComplete: "/customer/claim/complete",
    preferences: "/v1/me/preferences",
  },
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    verifyEmail: "/auth/verify-email",
    logout: "/auth/logout",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
    resendActivation: "/auth/resend-activation",
  },
} as const;
