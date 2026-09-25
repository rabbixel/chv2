/**
 * Backend route builders. Keeps every API path in one file so the eventual
 * backend contract has a single integration surface.
 */

export const apiEndpoints = {
  products: {
    list: "/v1/products",
    detail: (slug: string) => `/v1/products/${encodeURIComponent(slug)}`,
    related: (slug: string) =>
      `/v1/products/${encodeURIComponent(slug)}/related`,
  },
  categories: {
    list: "/v1/categories",
    detail: (slug: string) => `/v1/categories/${encodeURIComponent(slug)}`,
    products: (slug: string) =>
      `/v1/categories/${encodeURIComponent(slug)}/products`,
  },
  search: "/v1/search",
  collections: {
    list: "/v1/collections",
    detail: (slug: string) => `/v1/collections/${encodeURIComponent(slug)}`,
  },
  cart: "/v1/cart",
  wishlist: "/v1/wishlist",
  checkout: "/v1/checkout",
  orders: {
    list: "/v1/orders",
    detail: (id: string) => `/v1/orders/${encodeURIComponent(id)}`,
  },
  downloads: {
    list: "/v1/downloads",
    fulfil: (id: string) => `/v1/downloads/${encodeURIComponent(id)}/fulfil`,
  },
  customer: {
    me: "/v1/me",
  },
} as const;
