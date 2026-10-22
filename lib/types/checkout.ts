import type { Money } from "./common";

export interface CheckoutBilling {
  fullName: string;
  email: string;
  phone: string;
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

export interface PreparedCheckoutOrder {
  id: string;
  number: string;
  status: "pending" | "complete";
  total: Money;
  created: boolean;
  /** Server-only capability, consumed into an HttpOnly cookie by the BFF. */
  payment_authorization_token?: string;
}

export type PendingCheckoutOrder = PreparedCheckoutOrder;
