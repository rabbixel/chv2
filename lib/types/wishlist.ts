import type { ID, ISODateString } from "./common";

export interface WishlistItem {
  productId: ID;
  addedAt: ISODateString;
}

export interface Wishlist {
  id: ID;
  customerId: ID;
  items: WishlistItem[];
  updatedAt: ISODateString;
}
