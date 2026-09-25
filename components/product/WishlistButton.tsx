"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/utils";
import styles from "./WishlistButton.module.css";

export interface WishlistButtonProps {
  productId: string;
  productTitle: string;
  initialWishlisted?: boolean;
  className?: string;
}

/**
 * Wishlist toggle overlay for product cards.
 *
 * UI-only in this run (instant optimistic toggle). Persistence moves to the
 * wishlist API (server action + `wishlistService`) once sessions exist —
 * the `productId` prop is already the integration point.
 */
export function WishlistButton({
  productId,
  productTitle,
  initialWishlisted = false,
  className,
}: WishlistButtonProps) {
  const [wishlisted, setWishlisted] = useState(initialWishlisted);

  return (
    <button
      type="button"
      aria-pressed={wishlisted}
      aria-label={`${wishlisted ? "Remove" : "Save"} ${productTitle} ${wishlisted ? "from" : "to"} wishlist`}
      data-product-id={productId}
      className={cn(styles.button, wishlisted && styles.active, className)}
      onClick={() => setWishlisted((value) => !value)}
    >
      <Icon name="heart" size={18} />
    </button>
  );
}
