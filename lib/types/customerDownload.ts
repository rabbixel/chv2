import type { ID, ISODateString } from "./common";

export type DownloadAvailability =
  | "delivery_disabled"
  | "no_entitled_files"
  | "product_unavailable";

export interface CustomerDownloadItem {
  orderItemId: ID;
  productId: ID;
  title: string;
  thumbnailUrl: string | null;
  productUrl: string | null;
  priceId: number | null;
  quantity: number;
  entitledFileCount: number;
  availability: DownloadAvailability;
  downloadEnabled: false;
}

export interface CustomerDownloadPurchase {
  orderId: ID;
  orderNumber: string;
  purchaseDate: ISODateString;
  items: CustomerDownloadItem[];
}
