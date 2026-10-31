/**
 * Service layer barrel. Pages and components import service accessors from
 * `@/lib/services` — never from `@/data` or `@/lib/api` directly.
 */
export {
  AuthError,
  getAuthService,
  isWordPressAuthEnabled,
  toAuthError,
} from "./authService";
export type { AuthIdentity, AuthService, GuestClaimInput } from "./authService";
export { getCartService } from "./cartService";
export type { CartService } from "./cartService";
export { isLiveApiEnabled } from "./apiMode";
export { getCheckoutService } from "./checkoutService";
export type { CheckoutService } from "./checkoutService";
export { createFreeCheckoutSession, getFreeCheckoutSelection, resolveFreeCheckoutCart } from "./freeCheckoutService";
export { getCategoryService } from "./categoryService";
export { getHomepageService } from "./homepageService";
export type { HomepageSections, HomepageService } from "./homepageService";
export { getCollectionService } from "./collectionService";
export type { CollectionService } from "./collectionService";
export { getCollectionDirectoryService } from "./collectionDirectoryService";
export type { CollectionDirectoryEntry, CollectionDirectoryService } from "./collectionDirectoryService";
export type { CategoryService } from "./categoryService";
export { getCustomerService } from "./customerService";
export type { CustomerService } from "./customerService";
export { getDownloadService } from "./downloadService";
export type { DownloadService } from "./downloadService";
export { getLicenseService } from "./licenseService";
export type { LicenseService } from "./licenseService";
export { getOrderService } from "./orderService";
export { getCustomerOrderService } from "./customerOrderService";
export type { CustomerOrderService } from "./customerOrderService";
export { getCustomerDownloadService } from "./customerDownloadService";
export type { CustomerDownloadService } from "./customerDownloadService";
export { getCustomerLicenseService } from "./customerLicenseService";
export type { CustomerLicenseService } from "./customerLicenseService";
export { getCustomerProfileService } from "./customerProfileService";
export type { CustomerProfileService } from "./customerProfileService";
export type {
  CreateOrderInput,
  OrderService,
  VerifyPaymentInput,
} from "./orderService";
export {
  getCachedProductBySlug,
  getProductService,
  type ProductListParams,
  type ProductService,
  type ProductSortKey,
} from "./productService";
export { getSearchService } from "./searchService";
export type { SearchService } from "./searchService";
export { getWishlistService } from "./wishlistService";
export type { WishlistService } from "./wishlistService";
