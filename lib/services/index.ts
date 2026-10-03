/**
 * Service layer barrel. Pages and components import service accessors from
 * `@/lib/services` — never from `@/data` or `@/lib/api` directly.
 */
export { AuthError, getAuthService, toAuthError } from "./authService";
export type { AuthService } from "./authService";
export { getCartService } from "./cartService";
export type { CartService } from "./cartService";
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
export type {
  CreateOrderInput,
  OrderService,
  VerifyPaymentInput,
} from "./orderService";
export {
  getProductService,
  type ProductListParams,
  type ProductService,
  type ProductSortKey,
} from "./productService";
export { getSearchService } from "./searchService";
export type { SearchService } from "./searchService";
export { getWishlistService } from "./wishlistService";
export type { WishlistService } from "./wishlistService";
