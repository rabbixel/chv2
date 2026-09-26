import Link from "next/link";
import type { CSSProperties } from "react";
import {
  addWishlistItemToCart,
  removeWishlistItem,
} from "@/app/account/actions";
import { SubmitButton } from "@/components/checkout";
import { Card } from "@/components/ui";
import { routes } from "@/lib/routes";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import styles from "./WishlistItemCard.module.css";

export interface WishlistItemCardProps {
  product: Product;
}

/**
 * Saved-item card for the account wishlist: preview, price, remove and
 * add-to-cart. No license picker here — the default (personal, else the
 * first offered tier) goes in, and the cart owns license changes.
 */
export function WishlistItemCard({ product }: WishlistItemCardProps) {
  const art = product.images[0]?.placeholder;
  const license = product.licenses.includes("personal")
    ? "personal"
    : product.licenses[0];

  return (
    <Card className={styles.card}>
      <span
        className={styles.art}
        style={{ "--ch-art-hue": art?.hue ?? 150 } as CSSProperties}
        aria-hidden="true"
      >
        <span className={styles.monogram}>{art?.label ?? "CH"}</span>
      </span>
      <div className={styles.body}>
        <p className={styles.title}>
          <Link href={routes.product(product.slug)}>{product.title}</Link>
        </p>
        <p className={styles.price}>{formatMoney(product.price)}</p>
        <div className={styles.actions}>
          {license && (
            <form action={addWishlistItemToCart}>
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="license" value={license} />
              <SubmitButton size="sm" pendingLabel="Adding…">
                Add to cart
              </SubmitButton>
            </form>
          )}
          <form action={removeWishlistItem}>
            <input type="hidden" name="productId" value={product.id} />
            <SubmitButton size="sm" variant="ghost" pendingLabel="Removing…">
              Remove
            </SubmitButton>
          </form>
        </div>
      </div>
    </Card>
  );
}
