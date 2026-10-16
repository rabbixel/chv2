import type { Money } from "./common";

export interface CheckoutBilling {
  fullName: string;
  email: string;
  country: string;
  region: string;
  address?: string;
  city?: string;
  postalCode?: string;
}

export interface CheckoutQuote {
  currency: string;
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
  discountCode?: string;
  taxesEnabled: boolean;
}

export interface PendingCheckoutOrder {
  id: string;
  number: string;
  status: "pending";
  total: Money;
  created: boolean;
}
