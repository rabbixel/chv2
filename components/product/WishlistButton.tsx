"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState, useTransition } from "react";
import { setWishlistItemAction } from "@/app/account/actions";
import { Icon } from "@/components/ui";
import { WISHLIST_COUNT_EVENT } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import styles from "./WishlistButton.module.css";

export interface WishlistButtonProps {
  productId: string;
  productTitle: string;
  initialWishlisted?: boolean;
  returnTo?: string;
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
  returnTo,
  className,
}: WishlistButtonProps) {
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [error, setError] = useState<string | null>(null);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ productId?: string; saved?: boolean }>).detail;
      if (detail?.productId === productId && typeof detail.saved === "boolean") {
        setWishlisted(detail.saved);
      }
    };
    window.addEventListener(WISHLIST_COUNT_EVENT, sync);
    return () => window.removeEventListener(WISHLIST_COUNT_EVENT, sync);
  }, [productId]);

  function toggleWishlist() {
    if (pending) return;
    setError(null);
    setRequiresAuth(false);
    const nextSaved = !wishlisted;
    startTransition(async () => {
      try {
        const result = await setWishlistItemAction(productId, nextSaved);
        if ("error" in result) {
          setError(result.error);
          setRequiresAuth(Boolean(result.requiresAuth));
          return;
        }
        setWishlisted(result.saved);
        window.dispatchEvent(new CustomEvent(WISHLIST_COUNT_EVENT, {
          detail: { productId, saved: result.saved, count: result.count },
        }));
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
      {error && typeof document !== "undefined" && createPortal(
        <div className={styles.notice} role="alert" aria-live="assertive">
          <p className={styles.message}>{error}</p>
          {requiresAuth && (
            <Link className={styles.signIn} href={routes.login(returnTo ?? routes.accountWishlist())}>
              Sign in to save
            </Link>
          )}
          <button
            className={styles.dismiss}
            type="button"
            aria-label="Dismiss wishlist message"
            onClick={() => {
              setError(null);
              setRequiresAuth(false);
            }}
          >
            <Icon name="close" size={14} />
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
