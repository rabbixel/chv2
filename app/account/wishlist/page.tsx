import type { Metadata } from "next";
import Link from "next/link";
import { Button, Card, EmptyState } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getProductService, getWishlistService } from "@/lib/services";
import styles from "../section.module.css";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Your Creative Hatti wishlist.",
  alternates: { canonical: `${SITE.url}/account/wishlist` },
};

export default async function AccountWishlistPage() {
  const wishlist = await getWishlistService().getWishlist();
  const productService = getProductService();
  const items = await Promise.all(
    wishlist.items.map(async (item) => ({
      item,
      product: await productService.getProductBySlug(
        item.productId.replace(/^prod-/, ""),
      ),
    })),
  );

  return (
    <div>
      <h1 className={styles.title}>Wishlist</h1>
      <p className={styles.lede}>
        {wishlist.items.length}{" "}
        {wishlist.items.length === 1 ? "treasure" : "treasures"} saved for
        later.
      </p>
      {items.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Tap the heart on any product to keep it here."
          action={<Button href={routes.search()}>Browse products</Button>}
        />
      ) : (
        <div className={styles.list}>
          {items.map(({ item, product }) => (
            <Card key={item.productId}>
              <div className={styles.row}>
                <div className={styles.rowMain}>
                  <p className={styles.rowTitle}>
                    {product ? (
                      <Link href={routes.product(product.slug)}>
                        {product.title}
                      </Link>
                    ) : (
                      "Saved item"
                    )}
                  </p>
                  <p className={styles.rowMeta}>
                    Saved{product ? ` · ${product.productGroup}` : ""}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className={styles.note}>
        Wishlist syncs across your devices once accounts connect to the
        backend.
      </p>
    </div>
  );
}
