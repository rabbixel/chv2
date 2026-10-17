"use client";

import { useState, useTransition } from "react";
import { setWishlistItemAction } from "@/app/account/actions";
import { Icon } from "@/components/ui";
import { WISHLIST_COUNT_EVENT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import styles from "./WishlistButton.module.css";

export interface WishlistButtonProps {
  productId: string;
  productTitle: string;
  initialWishlisted?: boolean;
  className?: string;
}

/**
 * Wishlist toggle overlay for product cards. Persistence and membership
 * checks run through the server-side wishlist service.
 */
export function WishlistButton({
  productId,
  productTitle,
  initialWishlisted = false,
  className,
}: WishlistButtonProps) {
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleWishlist() {
    if (pending) return;
    setError(null);
    const nextSaved = !wishlisted;
    startTransition(async () => {
      try {
        const result = await setWishlistItemAction(productId, nextSaved);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setWishlisted(result.saved);
        window.dispatchEvent(new Event(WISHLIST_COUNT_EVENT));
      } catch {
        setError("Could not update your wishlist. Please try again.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        aria-pressed={wishlisted}
        aria-busy={pending}
        aria-label={`${wishlisted ? "Remove" : "Save"} ${productTitle} ${wishlisted ? "from" : "to"} wishlist`}
        data-product-id={productId}
        className={cn(styles.button, wishlisted && styles.active, className)}
        onClick={toggleWishlist}
        disabled={pending}
      >
        <Icon name="heart" size={18} />
      </button>
      {error && <span role="alert" className={styles.error}>{error}</span>}
    </>
  );
}
