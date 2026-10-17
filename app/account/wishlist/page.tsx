import type { Metadata } from "next";
import { removeWishlistItem } from "@/app/account/actions";
import { WishlistCountSync } from "@/components/account/WishlistCountSync";
import { WishlistItemCard } from "@/components/account";
import { Button, Card, EmptyState } from "@/components/ui";
import { SubmitButton } from "@/components/checkout";
import { SITE } from "@/lib/constants";
import { wishlistProductLookup, wishlistViewRows } from "@/lib/creative-hatti/wishlist";
import { routes } from "@/lib/routes";
import { getProductService, getWishlistService } from "@/lib/services";
import styles from "../section.module.css";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Your Creative Hatti wishlist.",
  alternates: { canonical: `${SITE.url}/account/wishlist` },
};

interface WishlistPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountWishlistPage({
  searchParams,
}: WishlistPageProps) {
  const query = (await searchParams) ?? {};
  const added = query.added === "1";
  const error = typeof query.error === "string" ? query.error : null;

  const wishlist = await getWishlistService().getWishlist();
  const productService = getProductService();
  const resolvedProducts = await Promise.all(wishlist.items.map(async ({ productId }) => {
    const lookup = wishlistProductLookup(productId);
    if (!lookup) return null;
    try {
      return lookup.kind === "id"
        ? await productService.getProductById(lookup.value)
        : await productService.getProductBySlug(lookup.value);
    } catch {
      return null;
    }
  }));
  const rows = wishlistViewRows(wishlist.items, resolvedProducts);

  return (
    <div>
      <WishlistCountSync count={wishlist.items.length} />
      <h1 className={styles.title}>Wishlist</h1>
      <p className={styles.lede}>
        {wishlist.items.length}{" "}
        {wishlist.items.length === 1 ? "treasure" : "treasures"} saved for
        later.
      </p>
      {added && (
        <p role="status" className={styles.notice}>
          Added to your cart.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Tap the heart on any product to keep it here."
          action={<Button href={routes.search()}>Browse products</Button>}
        />
      ) : (
        <div className={styles.tiles}>
          {rows.map(({ item, product, key }) => product ? (
            <WishlistItemCard key={key} product={product} />
          ) : (
            <Card key={key}>
              <p className={styles.rowTitle}>Saved product unavailable</p>
              <p className={styles.rowMeta}>This saved item is no longer in the catalogue or its details could not be loaded. It remains saved until you remove it.</p>
              <form action={removeWishlistItem}>
                <input type="hidden" name="productId" value={item.productId} />
                <SubmitButton variant="ghost" pendingLabel="Removing…">Remove saved item</SubmitButton>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
