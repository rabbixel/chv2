import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadButton } from "@/components/account";
import { Badge, Card } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getLicenseService, getOrderService } from "@/lib/services";
import { formatDate, formatMoney } from "@/lib/utils";
import styles from "../../section.module.css";

export const dynamic = "force-dynamic";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: OrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await getOrderService().getOrderById(id);
  return {
    title: order ? `Order ${order.number}` : "Order",
    description: "Your Creative Hatti order details.",
    alternates: { canonical: `${SITE.url}/account/orders/${id}` },
  };
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const order = await getOrderService().getOrderById(id);
  if (!order) notFound();

  const licenses = await getLicenseService().getLicensesByCodes(
    order.items.map((item) => item.license),
  );
  const licenseByCode = new Map(licenses.map((license) => [license.code, license]));

  return (
    <div>
      <Link href={routes.accountOrders()} className={styles.back}>
        ← All orders
      </Link>
      <h1 className={styles.title}>Order {order.number}</h1>
      <p className={styles.lede}>
        Placed {formatDate(order.createdAt)} ·{" "}
        {formatMoney(order.grandTotal)}
      </p>
      <Card>
        <dl className={styles.defs}>
          <dt>Status</dt>
          <dd>
            <Badge variant={order.status === "paid" ? "success" : "neutral"}>
              {order.status}
            </Badge>
          </dd>
          <dt>Subtotal</dt>
          <dd>{formatMoney(order.subtotal)}</dd>
          {order.discountTotal.amount > 0 && (
            <>
              <dt>Discount</dt>
              <dd>−{formatMoney(order.discountTotal)}</dd>
            </>
          )}
          <dt>Total</dt>
          <dd>{formatMoney(order.grandTotal)}</dd>
          <dt>Payment</dt>
          <dd>
            {order.payment.provider === "razorpay" ? "Razorpay" : order.payment.provider}
            {order.payment.reference ? ` · ${order.payment.reference}` : ""}
            {order.payment.failureReason
              ? ` · ${order.payment.failureReason}`
              : ""}
          </dd>
        </dl>
      </Card>
      <h2 className={styles.splitTitle}>Purchased products</h2>
      <div className={styles.list}>
        {order.items.map((item) => {
          const license = licenseByCode.get(item.license);
          return (
            <Card key={`${item.productId}:${item.license}`}>
              <div className={styles.row}>
                <div className={styles.rowMain}>
                  <p className={styles.rowTitle}>
                    <Link href={routes.product(item.productSlug)}>
                      {item.title}
                    </Link>
                  </p>
                  <p className={styles.rowMeta}>
                    {license ? `${license.name} license` : item.license} · Qty{" "}
                    {item.quantity} · {formatMoney(item.lineTotal)}
                  </p>
                  {license && (
                    <p className={styles.rowMeta}>
                      Allows: {license.allowedUses.join(" · ")}
                    </p>
                  )}
                </div>
                <div className={styles.rowSide}>
                  {order.status === "paid" ? (
                    <DownloadButton
                      productId={item.productId}
                      orderId={order.id}
                    />
                  ) : (
                    <span className={styles.rowMeta}>
                      Available after payment
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
