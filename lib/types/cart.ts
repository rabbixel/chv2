import type {
  CurrencyCode,
  ID,
  ISODateString,
  Money,
  Slug,
} from "./common";
import type { LicenseCode } from "./license";

export interface CartItem {
  /** Stable line key: `${productId}:${licenseCode}`. */
  key: string;
  productId: ID;
  productSlug: Slug;
  title: string;
  thumbnailUrl?: string;
  license: LicenseCode;
  /** Digital goods are quantity-1; kept for API compatibility. */
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface Cart {
  id: ID;
  currency: CurrencyCode;
  items: CartItem[];
  itemCount: number;
  subtotal: Money;
  updatedAt: ISODateString;
}
