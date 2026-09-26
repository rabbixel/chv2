import type { Metadata } from "next";
import { WishlistItemCard } from "@/components/account";
import { Button, EmptyState } from "@/components/ui";
import { SITE } from "@/lib/constants";
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
  const products = (
    await Promise.all(
      wishlist.items.map((item) =>
        productService.getProductBySlug(
          item.productId.replace(/^prod-/, ""),
        ),
      ),
    )
  ).filter((product) => product !== null);

  return (
    <div>
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
      {products.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Tap the heart on any product to keep it here."
          action={<Button href={routes.search()}>Browse products</Button>}
        />
      ) : (
        <div className={styles.tiles}>
          {products.map((product) => (
            <WishlistItemCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
