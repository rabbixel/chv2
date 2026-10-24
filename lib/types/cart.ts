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
  priceId?: number | null;
  optionName?: string;
  available?: boolean;
  availabilityMessage?: string;
  priceOptions?: Array<{ id: number; name: string; price: Money }>;
  license: LicenseCode;
  /** Digital goods are quantity-1; kept for API compatibility. */
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

/** Persisted cart identity used by thumbnail controls; prices stay server-side. */
export interface CartLineIdentity {
  productId: ID;
  priceId: number | null;
}

/** Order snapshot identity used to remove only the lines purchased at checkout. */
export interface CheckoutCartLine extends CartLineIdentity {
  quantity: number;
}

export interface Cart {
  id: ID;
  currency: CurrencyCode;
  items: CartItem[];
  itemCount: number;
  subtotal: Money;
  /** Applied coupon code, if any. */
  couponCode?: string;
  /** Coupon discount (absent when no coupon applies). */
  discount?: Money;
  /** Grand total: subtotal minus discount. Digital goods, no shipping. */
  total: Money;
  updatedAt: ISODateString;
}
