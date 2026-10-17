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
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
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

  const productBySlug = new Map<string, Product>();
  const productSlugs = [...new Set(cart.items.filter((item) => item.available !== false).map((item) => item.productSlug))];
  await Promise.all(productSlugs.map(async (slug) => {
    try {
      const product = await getProductService().getProductBySlug(slug);
      if (product) productBySlug.set(slug, product);
    } catch {
      // Keep the cart usable if optional image/product detail lookup is unavailable.
    }
  }));

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
                productImage={productBySlug.get(item.productSlug)?.images.find((image) => Boolean(image.url)) ?? null}
                licenseControl={process.env.USE_MOCK_API === "false" ? item.priceOptions && item.priceOptions.length > 1 ? (
                  <CartLicenseSelect
                    itemKey={item.key}
                    title={item.title}
                    current={item.license}
                    options={[item.license]}
                    priceOptions={item.priceOptions}
                    currentPriceId={item.priceId}
                  />
                ) : undefined : (
                  <CartLicenseSelect
                    itemKey={item.key}
                    title={item.title}
                    current={item.license}
                    options={productBySlug.get(item.productSlug)?.licenses ?? [item.license]}
                  />
                )}
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
            <CartSummary cart={cart} action={<div className={styles.desktopCheckout}><Button href={routes.checkout()} fullWidth>Proceed to checkout</Button></div>} />
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
        <div className={styles.mobileCheckout}>
          <div className={styles.mobileTotal}>
            <span>Total</span>
            <strong>{formatMoney(cart.total)}</strong>
          </div>
          <Button href={routes.checkout()} fullWidth>Proceed to checkout</Button>
        </div>
      </div>
    </Container>
  );
}
