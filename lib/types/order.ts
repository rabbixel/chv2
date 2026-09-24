import type {
  CurrencyCode,
  ID,
  ISODateString,
  Money,
  Slug,
} from "./common";
import type { LicenseCode } from "./license";

export type OrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";

export type PaymentProvider = "razorpay";

export type PaymentStatus = "pending" | "captured" | "failed" | "refunded";

export interface OrderItem {
  productId: ID;
  productSlug: Slug;
  title: string;
  thumbnailUrl?: string;
  license: LicenseCode;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface OrderPayment {
  provider: PaymentProvider;
  status: PaymentStatus;
  /** Provider-side reference (e.g. Razorpay payment id). No secrets. */
  reference?: string;
}

export interface Order {
  id: ID;
  /** Human-facing number, e.g. `CH-2026-004213`. */
  number: string;
  customerId: ID;
  currency: CurrencyCode;
  items: OrderItem[];
  subtotal: Money;
  discountTotal: Money;
  taxTotal: Money;
  grandTotal: Money;
  status: OrderStatus;
  payment: OrderPayment;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
