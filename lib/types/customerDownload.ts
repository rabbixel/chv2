import type { ID, ISODateString } from "./common";

export type DownloadAvailability =
  | "available"
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
  downloadEnabled: boolean;
  files: CustomerDownloadFile[];
}

export interface CustomerDownloadFile {
  key: string;
  name: string;
}

export interface CustomerDownloadPurchase {
  orderId: ID;
  orderNumber: string;
  purchaseDate: ISODateString;
  items: CustomerDownloadItem[];
}
