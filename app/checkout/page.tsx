import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { Breadcrumbs, Container } from "@/components/layout";
import { Button, EmptyState } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getCompletedDownloadOrderReference } from "@/lib/payments/checkoutDownloadAccess.mjs";
import { getAuthService, getCartService, getCheckoutService, isLiveApiEnabled, isWordPressAuthEnabled } from "@/lib/services";
import { getCompletedOrderDownloads, getCheckoutOrderStatus } from "./actions";
import { CheckoutForm } from "./CheckoutForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Review your order before it is prepared for payment.",
  alternates: { canonical: `${SITE.url}/checkout` },
  robots: { index: false, follow: false },
};

interface CheckoutPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const [cart, query] = await Promise.all([getCartService().getSessionCart(), searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>)]);
  const requestedOrderReference = typeof query.prepared === "string" ? query.prepared : typeof query.completed === "string" ? query.completed : undefined;
  const initialOrderStatus = requestedOrderReference ? await getCheckoutOrderStatus(requestedOrderReference) : null;
  const completedReference = getCompletedDownloadOrderReference(initialOrderStatus);
  const initialDownloadsResult = completedReference ? await getCompletedOrderDownloads(completedReference) : null;
  const initialOrderDownloads = initialDownloadsResult?.downloads ?? null;
  const errorCode = typeof query.error === "string" ? query.error : "";
  const errors: Record<string, string> = {
    terms: "Accept the Terms and Privacy Policy to continue.",
    cart: "Your cart has unavailable items. Return to your cart and remove them.",
    session: "Your checkout session expired. Refresh checkout and try again.",
    "zero-total": "We could not complete this free order. Please retry with the same checkout session.",
    discount: "The discount code is unavailable or not eligible for this cart.",
    prepare: "We could not prepare the pending order. Review your details and try again.",
  };

  if (!cart.items.length && !completedReference) return <Container size="narrow"><div className={styles.page}>
    <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart", href: routes.cart() }, { label: "Checkout" }]} />
    {requestedOrderReference ? <EmptyState headingLevel="h1" title="Order access unavailable" description="This order is not available in this browser session. For security, downloads require the original checkout capability. You can use the verified account-claim process to recover eligible purchases." action={<Button href={routes.claimAccount()}>Claim a purchase</Button>} /> : <EmptyState headingLevel="h1" title="Your cart is empty" description="Add a digital product before checking out." action={<Button href={routes.search()}>Browse products</Button>} />}
  </div></Container>;

  const hasUnavailable = cart.items.some((item) => item.available === false);
  const checkoutEnabled = isLiveApiEnabled();
  let identity = null;
  if (checkoutEnabled && isWordPressAuthEnabled()) identity = await getAuthService().getCurrentIdentity();
  const initialName = identity ? [identity.user.firstName, identity.user.lastName].filter(Boolean).join(" ") : "";
  const initialEmail = identity?.user.email ?? "";
  const initialPhone = identity?.user.phone ?? "+91 ";
  let initialQuote = null;
  let quoteError: string | undefined;
  if (checkoutEnabled && !hasUnavailable && !completedReference) {
    try {
      initialQuote = await getCheckoutService().quote({ cart, billing: { country: "IN", region: "" } });
    } catch {
      quoteError = "Checkout totals are temporarily unavailable. Refresh and try again.";
    }
  }

  return <Container>
    <div className={styles.page}>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cart", href: routes.cart() }, { label: "Checkout" }]} />
      <h1 className={styles.title}>Checkout</h1>
      {errorCode && <p role="alert" className={styles.error}>{errors[errorCode] ?? "Checkout could not be completed."}</p>}
      {hasUnavailable && <p role="alert" className={styles.error}>Your cart contains unavailable products. Remove them before checkout.</p>}
      {!checkoutEnabled && <p role="alert" className={styles.error}>Checkout is unavailable in mock mode. Configure the local WordPress/EDD API to prepare real pending orders.</p>}
      {!checkoutEnabled || hasUnavailable ? <section className={styles.pendingNotice}>
        <p>Checkout needs an available cart and the configured WordPress/EDD backend.</p>
        <Button href={routes.cart()}>Return to cart</Button>
      </section> : <CheckoutForm
        cart={cart}
        initialQuote={initialQuote}
        initialQuoteError={quoteError}
        initialName={initialName}
        initialEmail={initialEmail}
        initialPhone={initialPhone}
        signedIn={Boolean(identity)}
        idempotencyKey={randomUUID()}
        initialOrderStatus={initialOrderStatus}
        initialOrderDownloads={initialOrderDownloads}
        initialDownloadsError={initialDownloadsResult?.error ?? null}
      />}
    </div>
  </Container>;
}
