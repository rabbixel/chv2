import type { ID, ISODateString } from "./common";

export interface Address {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
}

export interface Customer {
  id: ID;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  billingAddress?: Address;
  createdAt: ISODateString;
}

export interface UpdateProfileInput {
  firstName: string;
  lastName: string;
}

export interface NotificationPreferences {
  orderUpdates: boolean;
  newProducts: boolean;
  offers: boolean;
}
