import Link from "next/link";
import {
  addWishlistItemToCart,
  removeWishlistItem,
} from "@/app/account/actions";
import { SubmitButton } from "@/components/checkout";
import { WishlistProductArtwork } from "@/components/account/WishlistProductArtwork";
import { Card } from "@/components/ui";
import { wishlistImageSource } from "@/lib/creative-hatti/wishlist";
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
  const cover = product.images.find((image) => wishlistImageSource(image));
  const art = cover?.placeholder ?? product.images[0]?.placeholder;
  const license = product.licenses.includes("personal")
    ? "personal"
    : product.licenses[0];

  return (
    <Card className={styles.card}>
      <WishlistProductArtwork
        image={cover}
        title={product.title}
        placeholderLabel={art?.label ?? "CH"}
        placeholderHue={art?.hue ?? 150}
        className={styles.art}
        imageClassName={styles.image}
      />
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
