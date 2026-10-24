export interface PersistedCartLine {
  product_id: number;
  price_id: number | null;
  quantity: number;
}

export interface PurchasedCartLine {
  productId: string;
  priceId: number | null;
  quantity: number;
}

export interface CartCleanupStatus {
  fulfilled?: boolean;
  free_completed?: boolean;
}

export function removePurchasedCartLines(current: PersistedCartLine[], purchased: PurchasedCartLine[]): PersistedCartLine[];
export function checkoutStatusAllowsCartCleanup(status: CartCleanupStatus | null | undefined): boolean;
