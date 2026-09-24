import type { ID, ISODateString, Slug } from "./common";

/**
 * A fulfilment record for a purchased digital file.
 * URLs are short-lived signed links minted by the backend at request time —
 * the frontend never constructs storage URLs itself.
 */
export interface Download {
  id: ID;
  orderId: ID;
  productId: ID;
  productSlug: Slug;
  productTitle: string;
  fileName: string;
  fileSizeBytes: number;
  /** Signed URL; only present immediately after a fulfilment request. */
  url?: string;
  urlExpiresAt?: ISODateString;
  downloadCount: number;
  downloadLimit: number;
  createdAt: ISODateString;
}
