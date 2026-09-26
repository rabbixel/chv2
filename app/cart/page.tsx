import type { Metadata } from "next";
import { Breadcrumbs, Container } from "@/components/layout";
import {
  CartItemRow,
  CartLicenseSelect,
  CartSummary,
} from "@/components/cart";
import { SubmitButton } from "@/components/checkout";
import { WishlistButton } from "@/components/product";
import { Button, EmptyState } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getCartService, getProductService } from "@/lib/services";
import { clearCart, removeFromCart } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cart",
  description: `Review your Creative Hatti downloads before checkout.`,
  alternates: { canonical: `${SITE.url}/cart` },
  robots: { index: false, follow: false },
};

interface CartPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CartPage({ searchParams }: CartPageProps) {
  const cart = await getCartService().getSessionCart();
  const query = (await searchParams) ?? {};
  const error = typeof query.error === "string" ? query.error : null;

  if (cart.items.length === 0) {
    return (
      <Container size="narrow">
        <div className={styles.page}>
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Cart" }]}
          />
          <EmptyState
            headingLevel="h1"
            title="Your cart is empty"
            description="Every download is instant — find your next Indian vector, character or template."
            action={<Button href={routes.search()}>Browse products</Button>}
          />
        </div>
      </Container>
    );
  }

  const licenseOptions = new Map<string, Parameters<typeof CartLicenseSelect>[0]["options"]>();
  await Promise.all(
    cart.items.map(async (item) => {
      const product = await getProductService().getProductBySlug(
        item.productSlug,
      );
      licenseOptions.set(item.productId, product?.licenses ?? [item.license]);
    }),
  );

  return (
    <Container>
      <div className={styles.page}>
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Cart" }]}
        />
        <h1 className={styles.title}>Cart</h1>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className={styles.layout}>
          <ul className={styles.lines} aria-label="Cart items">
            {cart.items.map((item) => (
              <CartItemRow
                key={item.key}
                item={item}
                licenseControl={
                  <CartLicenseSelect
                    itemKey={item.key}
                    title={item.title}
                    current={item.license}
                    options={
                      licenseOptions.get(item.productId) ?? [item.license]
                    }
                  />
                }
                actions={
                  <div className={styles.lineActions}>
                    <form action={removeFromCart}>
                      <input type="hidden" name="key" value={item.key} />
                      <button
                        type="submit"
                        className={styles.remove}
                        aria-label={`Remove ${item.title} from cart`}
                      >
                        Remove
                      </button>
                    </form>
                    <WishlistButton
                      productId={item.productId}
                      productTitle={item.title}
                    />
                  </div>
                }
              />
            ))}
          </ul>
          <div className={styles.side}>
            <CartSummary cart={cart} />
            <form action={clearCart}>
              <SubmitButton
                variant="ghost"
                fullWidth
                pendingLabel="Clearing…"
              >
                Clear cart
              </SubmitButton>
            </form>
            <p className={styles.note}>
              Digital downloads — no shipping needed.
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}
