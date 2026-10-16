import type { ISODateString } from "./common";

export interface CustomerProfile {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  createdAt: ISODateString;
}

export interface UpdateCustomerProfileInput {
  firstName: string;
  lastName: string;
}
