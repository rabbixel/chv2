import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs, Container } from "@/components/layout";
import { Badge, Button, Card, Icon } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getOrderService } from "@/lib/services";
import { formatMoney } from "@/lib/utils";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface SuccessPageProps {
  params: Promise<{ orderId: string }>;
}

export async function generateMetadata({
  params,
}: SuccessPageProps): Promise<Metadata> {
  const { orderId } = await params;
  const order = await getOrderService().getOrderById(orderId);
  if (!order) return { title: "Order not found" };
  return {
    title: `Order confirmed · ${order.number}`,
    description: `Order ${order.number} confirmed on ${SITE.name}.`,
    alternates: { canonical: `${SITE.url}/checkout/success/${orderId}` },
    robots: { index: false, follow: false },
  };
}

export default async function SuccessPage({ params }: SuccessPageProps) {
  const { orderId } = await params;
  const order = await getOrderService().getOrderById(orderId);
  // No loading.tsx in this segment on purpose: a Suspense fallback would
  // absorb this notFound() and serve HTTP 200 with the skeleton forever
  // (vercel/next.js#98954).
  if (!order) notFound();
  if (order.status === "pending" || order.status === "cancelled") {
    redirect(routes.checkoutPay(order.id));
  }
  if (order.status === "failed") redirect(routes.checkoutFailed(order.id));

  const mockPayments = process.env.USE_MOCK_API !== "false";

  return (
    <Container size="narrow">
      <div className={styles.page}>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Checkout", href: routes.checkout() },
            { label: "Confirmed" },
          ]}
        />
        <Card padding="lg" className={styles.outcome}>
          <span className={styles.check} aria-hidden="true">
            <Icon name="check" size={32} />
          </span>
          <h1 className={styles.title}>Payment successful</h1>
          <p className={styles.orderNumber}>Order {order.number}</p>
          {mockPayments && (
            <p className={styles.testNote}>
              <Badge variant="info">Test order</Badge> No real payment was
              processed.
            </p>
          )}
          <dl className={styles.recap}>
            {order.items.map((item) => (
              <div key={`${item.productId}:${item.license}`} className={styles.row}>
                <dt>{item.title}</dt>
                <dd>{formatMoney(item.lineTotal)}</dd>
              </div>
            ))}
            {order.discountTotal.amount > 0 && (
              <div className={styles.row}>
                <dt>Discount</dt>
                <dd>−{formatMoney(order.discountTotal)}</dd>
              </div>
            )}
            <div className={`${styles.row} ${styles.total}`}>
              <dt>Total paid</dt>
              <dd>{formatMoney(order.grandTotal)}</dd>
            </div>
          </dl>
          {order.customer?.email && (
            <p className={styles.meta}>Receipt email: {order.customer.email}</p>
          )}
          <p className={styles.meta}>
            Your files will be ready in Downloads once backend fulfilment
            lands.
          </p>
          <div className={styles.actions}>
            <Button href={routes.accountDownloads()} fullWidth>
              Go to downloads
            </Button>
            <Button variant="ghost" href={routes.search()} fullWidth>
              Continue shopping
            </Button>
          </div>
        </Card>
      </div>
    </Container>
  );
}
