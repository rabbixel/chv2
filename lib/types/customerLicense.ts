import type { ID, ISODateString } from "./common";

export interface CustomerLicense {
  id: ID;
  productId: ID;
  productTitle: string;
  productUrl: string | null;
  productAvailable: boolean;
  status: string;
  purchaseId: ID | null;
  purchaseNumber: string | null;
  activationCount: number;
  activationLimit: number | null;
  expiresAt: ISODateString | null;
  lifetime: boolean;
  maskedKey: string | null;
}
