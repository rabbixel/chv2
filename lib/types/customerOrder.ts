import type { CurrencyCode, ID, ISODateString, Money } from "./common";

export interface CustomerOrderItem {
  productId: ID;
  name: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
  priceId: number | null;
  thumbnailUrl: string | null;
  productUrl: string | null;
}

export interface CustomerOrderRefund {
  id: number;
  number: string;
  date: ISODateString;
  status: string;
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
}

export interface CustomerOrderAdjustment {
  type: string;
  subtotal: Money;
  tax: Money;
  total: Money;
}

export interface CustomerOrder {
  id: ID;
  number: string;
  date: ISODateString;
  status: string;
  currency: CurrencyCode;
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
  paymentMethod: string;
  items: CustomerOrderItem[];
  refunds: CustomerOrderRefund[];
  adjustments: CustomerOrderAdjustment[];
}

export interface CustomerReceipt extends CustomerOrder {
  documentType: "receipt" | "order_summary";
  billing: {
    name: string;
    email: string;
    address: string;
    address2: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
  transactionReference: string;
  couponCodes: string[];
}
