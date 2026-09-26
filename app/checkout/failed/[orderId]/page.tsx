import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs, Container } from "@/components/layout";
import { Button, Card, Icon } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getOrderService } from "@/lib/services";
import { formatMoney } from "@/lib/utils";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface FailedPageProps {
  params: Promise<{ orderId: string }>;
}

export async function generateMetadata({
  params,
}: FailedPageProps): Promise<Metadata> {
  const { orderId } = await params;
  const order = await getOrderService().getOrderById(orderId);
  if (!order) return { title: "Order not found" };
  return {
    title: `Payment failed · ${order.number}`,
    description: `Payment for order ${order.number} did not go through.`,
    alternates: { canonical: `${SITE.url}/checkout/failed/${orderId}` },
    robots: { index: false, follow: false },
  };
}

export default async function FailedPage({ params }: FailedPageProps) {
  const { orderId } = await params;
  const order = await getOrderService().getOrderById(orderId);
  // No loading.tsx in this segment on purpose: a Suspense fallback would
  // absorb this notFound() and serve HTTP 200 with the skeleton forever
  // (vercel/next.js#98954).
  if (!order) notFound();
  if (order.status === "paid") redirect(routes.checkoutSuccess(order.id));
  if (order.status === "pending" || order.status === "cancelled") {
    redirect(routes.checkoutPay(order.id));
  }

  return (
    <Container size="narrow">
      <div className={styles.page}>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Checkout", href: routes.checkout() },
            { label: "Failed" },
          ]}
        />
        <Card padding="lg" className={styles.outcome}>
          <span className={styles.cross} aria-hidden="true">
            <Icon name="close" size={28} />
          </span>
          <h1 className={styles.title}>Payment failed</h1>
          <p className={styles.orderNumber}>Order {order.number}</p>
          <p role="status" className={styles.reason}>
            {order.payment.failureReason ?? "The payment did not go through."}{" "}
            No money was charged.
          </p>
          <dl className={styles.recap}>
            <div className={styles.row}>
              <dt>
                {order.items.length}{" "}
                {order.items.length === 1 ? "download" : "downloads"}
              </dt>
              <dd>{formatMoney(order.grandTotal)}</dd>
            </div>
          </dl>
          <p className={styles.meta}>
            Your cart is intact — try again with a new checkout.
          </p>
          <div className={styles.actions}>
            <Button href={routes.checkout()} fullWidth>
              Try again
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
