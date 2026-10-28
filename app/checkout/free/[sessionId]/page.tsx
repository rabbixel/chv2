import type { Metadata } from "next";
import { Container } from "@/components/layout";
import { Button } from "@/components/ui";
import { routes } from "@/lib/routes";
import { getAuthService, getFreeCheckoutSelection, resolveFreeCheckoutCart, isLiveApiEnabled, isWordPressAuthEnabled } from "@/lib/services";
import { getCheckoutOrderStatus, getCompletedOrderDownloads } from "../../actions";
import { CheckoutForm } from "../../CheckoutForm";
import type { Cart, CheckoutQuote } from "@/lib/types";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Free download checkout", robots: { index: false, follow: false } };

async function loadCheckout(sessionId: string, query: Record<string, string | string[] | undefined>) {
    if (!isLiveApiEnabled()) throw new Error("Checkout is temporarily unavailable.");
    const selection = await getFreeCheckoutSelection(sessionId);
    const reference = typeof query.completed === "string" ? query.completed : undefined;
    const status = reference ? await getCheckoutOrderStatus(reference, sessionId) : null;
    if (reference && !status?.free_completed) throw new Error("This completed order is not available in this free checkout session.");
    const downloads = status?.free_completed ? await getCompletedOrderDownloads(status.edd_order_reference, sessionId) : null;
    let cart: Cart;
    try { cart = await resolveFreeCheckoutCart(selection, true); }
    catch (error) {
      if (!status?.free_completed) throw error;
      // Completion remains recoverable if the product later becomes unavailable.
      const zero = { amount: 0, currency: "INR" };
      cart = { id: "independent-free", currency: "INR", items: [], itemCount: 0, subtotal: zero, total: zero, updatedAt: new Date().toISOString() };
    }
    const identity = isWordPressAuthEnabled() ? await getAuthService().getCurrentIdentity() : null;
    // The projection is only a preview. Preparation revalidates EDD price, tax,
    // and limits under the existing lock and rejects any nonzero total.
    const quote: CheckoutQuote = { currency: cart.currency, subtotal: cart.subtotal, total: cart.total,
      discount: cart.total, tax: cart.total, taxesEnabled: selection.taxesEnabled === true };
    return { cart, quote, identity, selection, status, downloads };
}

export default async function FreeCheckoutPage({ params, searchParams }: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sessionId } = await params;
  let data;
  let errorMessage = "Return to the product and try again.";
  try { data = await loadCheckout(sessionId, await searchParams); }
  catch (error) { if (error instanceof Error) errorMessage = error.message; }
  if (!data) return <Container size="narrow"><div className={styles.page}>
    <h1 className={styles.title}>Free checkout unavailable</h1>
    <p role="alert">{errorMessage}</p>
    <Button href={routes.search()}>Browse products</Button>
  </div></Container>;
  const { cart, quote, identity, selection, status, downloads } = data;
  return <Container><div className={styles.page}>
      <h1 className={styles.title}>Free download checkout</h1>
      <p>Your regular cart stays unchanged.</p>
      <CheckoutForm cart={cart} initialQuote={quote}
        initialName={identity ? [identity.user.firstName, identity.user.lastName].filter(Boolean).join(" ") : ""}
        initialEmail={identity?.user.email ?? ""} initialPhone={identity?.user.phone ?? "+91 "}
        signedIn={Boolean(identity)} idempotencyKey={selection.idempotencyKey} freeSessionId={sessionId}
        initialOrderStatus={status} initialOrderDownloads={downloads?.downloads ?? null} initialDownloadsError={downloads?.error ?? null} />
    </div></Container>;
}
