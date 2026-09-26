import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs, Container } from "@/components/layout";
import { RazorpayButton, SubmitButton } from "@/components/checkout";
import { Badge, Button, Card } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getOrderService } from "@/lib/services";
import { formatMoney } from "@/lib/utils";
import { cancelPayment, simulateTestPayment } from "../../actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface PayPageProps {
  params: Promise<{ orderId: string }>;
}

export async function generateMetadata({
  params,
}: PayPageProps): Promise<Metadata> {
  const { orderId } = await params;
  const order = await getOrderService().getOrderById(orderId);
  if (!order) return { title: "Payment not found" };
  return {
    title: `Payment · ${order.number}`,
    description: `Complete payment for order ${order.number} on ${SITE.name}.`,
    alternates: { canonical: `${SITE.url}/checkout/pay/${orderId}` },
    robots: { index: false, follow: false },
  };
}

const FAILURE_REASONS = [
  "Card declined by the bank",
  "Insufficient funds",
  "Payment timed out",
];

export default async function PayPage({ params }: PayPageProps) {
  const { orderId } = await params;
  const order = await getOrderService().getOrderById(orderId);
  // No loading.tsx in this segment on purpose: a Suspense fallback would
  // absorb this notFound() and serve HTTP 200 with the skeleton forever
  // (vercel/next.js#98954).
  if (!order) notFound();
  if (order.status === "paid") redirect(routes.checkoutSuccess(order.id));
  if (order.status === "failed") redirect(routes.checkoutFailed(order.id));

  if (order.status === "cancelled") {
    return (
      <Container size="narrow">
        <div className={styles.page}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Checkout", href: routes.checkout() },
              { label: "Payment" },
            ]}
          />
          <Card padding="lg" className={styles.outcome}>
            <p className={styles.outcomeTitle}>Payment cancelled</p>
            <p className={styles.outcomeText}>
              Order {order.number} was cancelled and no money was charged.
              Your cart is intact — start a new checkout whenever ready.
            </p>
            <div className={styles.outcomeActions}>
              <Button href={routes.checkout()} fullWidth>
                Back to checkout
              </Button>
              <Button variant="ghost" href={routes.cart()} fullWidth>
                Back to cart
              </Button>
            </div>
          </Card>
        </div>
      </Container>
    );
  }

  const mockPayments = process.env.USE_MOCK_API !== "false";
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
  const providerOrderId = order.payment.providerOrderId ?? "";

  return (
    <Container size="narrow">
      <div className={styles.page}>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Checkout", href: routes.checkout() },
            { label: "Payment" },
          ]}
        />
        <h1 className={styles.title}>Payment</h1>
        <Card padding="md" className={styles.recap}>
          <dl className={styles.recapRows}>
            <div className={styles.recapRow}>
              <dt>Order</dt>
              <dd>{order.number}</dd>
            </div>
            <div className={styles.recapRow}>
              <dt>Items</dt>
              <dd>
                {order.items.length}{" "}
                {order.items.length === 1 ? "download" : "downloads"}
              </dd>
            </div>
            <div className={`${styles.recapRow} ${styles.recapTotal}`}>
              <dt>Total</dt>
              <dd>{formatMoney(order.grandTotal)}</dd>
            </div>
          </dl>
        </Card>

        {mockPayments ? (
          <section aria-labelledby="test-sandbox" className={styles.sandbox}>
            <h2 id="test-sandbox" className={styles.sandboxHeading}>
              <Badge variant="info">Test mode</Badge>
              <span>Payment sandbox</span>
            </h2>
            <p className={styles.sandboxNote}>
              Simulated payments only — no real money moves. Each choice
              drives the real order states end to end.
            </p>
            <form action={simulateTestPayment}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="outcome" value="success" />
              <SubmitButton
                size="lg"
                fullWidth
                pendingLabel="Processing…"
              >
                Simulate successful payment
              </SubmitButton>
            </form>
            <form action={simulateTestPayment} className={styles.failForm}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="outcome" value="failure" />
              <label className={styles.reasonLabel}>
                Failure reason
                <select name="reason" className={styles.reasonSelect}>
                  {FAILURE_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>
              <SubmitButton
                variant="secondary"
                fullWidth
                pendingLabel="Processing…"
              >
                Simulate failed payment
              </SubmitButton>
            </form>
            <form action={cancelPayment}>
              <input type="hidden" name="orderId" value={order.id} />
              <SubmitButton
                variant="ghost"
                fullWidth
                pendingLabel="Cancelling…"
              >
                Cancel payment
              </SubmitButton>
            </form>
          </section>
        ) : keyId && providerOrderId ? (
          <div className={styles.razorpay}>
            <RazorpayButton
              orderId={order.id}
              orderNumber={order.number}
              keyId={keyId}
              providerOrderId={providerOrderId}
              amountPaise={order.grandTotal.amount}
              currency={order.grandTotal.currency}
              totalLabel={formatMoney(order.grandTotal)}
              customerName={order.customer?.fullName}
              customerEmail={order.customer?.email}
              customerPhone={order.customer?.phone}
            />
            <p className={styles.secureNote}>
              Payments are processed securely by Razorpay.
            </p>
          </div>
        ) : (
          <p role="alert" className={styles.error}>
            Payments are not configured yet. The backend must provide a
            Razorpay order before this order can be paid.
          </p>
        )}
      </div>
    </Container>
  );
}
