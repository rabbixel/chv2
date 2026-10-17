import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AccountProductArtwork, DownloadButton } from "@/components/account";
import { Badge, Card } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import {
  getLicenseService,
  getCustomerOrderService,
  getOrderService,
  isWordPressAuthEnabled,
} from "@/lib/services";
import { formatDate, formatMoney } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { resolveProductImagesByUrl } from "@/lib/services/productService";
import styles from "../../section.module.css";

export const dynamic = "force-dynamic";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: OrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  if (isWordPressAuthEnabled()) {
    return {
      title: "Order",
      description: "Your Creative Hatti order details.",
      alternates: { canonical: `${SITE.url}/account/orders/${id}` },
    };
  }
  const order = await getOrderService().getOrderById(id);
  return {
    title: order ? `Order ${order.number}` : "Order",
    description: "Your Creative Hatti order details.",
    alternates: { canonical: `${SITE.url}/account/orders/${id}` },
  };
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  if (isWordPressAuthEnabled()) {
    let order;
    try {
      order = await getCustomerOrderService().get(id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirect(routes.login(routes.accountOrder(id)));
      }
      return (
        <div>
          <Link href={routes.accountOrders()} className={styles.back}>← All orders</Link>
          <h1 className={styles.title}>Order unavailable</h1>
          <p className={styles.lede}>Please refresh the page or try again shortly.</p>
        </div>
      );
    }
    if (!order) notFound();
    const productImages = await resolveProductImagesByUrl(
      order.items.map((item) => item.productUrl),
    );

    return (
      <div>
        <Link href={routes.accountOrders()} className={styles.back}>← All orders</Link>
        <h1 className={styles.title}>Order {order.number}</h1>
        <p className={styles.lede}>Placed {formatDate(order.date)} · {formatMoney(order.total)}</p>
        <Card>
          <dl className={styles.defs}>
            <dt>Status</dt><dd><Badge variant={order.status === "complete" ? "success" : "neutral"}>{order.status.replaceAll("_", " ")}</Badge></dd>
            <dt>Subtotal</dt><dd>{formatMoney(order.subtotal)}</dd>
            <dt>Discount</dt><dd>{formatMoney(order.discount)}</dd>
            <dt>Tax</dt><dd>{formatMoney(order.tax)}</dd>
            <dt>Total</dt><dd>{formatMoney(order.total)}</dd>
            {order.paymentMethod && <><dt>Payment method</dt><dd>{order.paymentMethod}</dd></>}
          </dl>
        </Card>
        <h2 className={styles.splitTitle}>Purchased products</h2>
        <div className={styles.list}>
          {order.items.map((item, index) => (
            <Card key={`${item.productId}:${item.priceId ?? "base"}:${index}`}>
              <div className={styles.row}>
                <AccountProductArtwork
                  title={item.name}
                  image={item.productUrl ? productImages.get(item.productUrl) : undefined}
                  fallbackUrl={item.thumbnailUrl}
                />
                <div className={styles.rowMain}>
                  <p className={styles.rowTitle}>
                    {item.productUrl ? <Link href={item.productUrl}>{item.name}</Link> : item.name}
                  </p>
                  <p className={styles.rowMeta}>
                    Qty {item.quantity}{item.priceId !== null ? ` · Price option ${item.priceId}` : ""} · {formatMoney(item.unitPrice)} each · {formatMoney(item.lineTotal)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
        {order.refunds.length > 0 && (
          <>
            <h2 className={styles.splitTitle}>Refunds and adjustments</h2>
            <div className={styles.list}>
              {order.refunds.map((refund) => (
                <Card key={refund.id}>
                  <div className={styles.row}>
                    <div className={styles.rowMain}>
                      <p className={styles.rowTitle}>Refund {refund.number}</p>
                      <p className={styles.rowMeta}>{formatDate(refund.date)} · {refund.status.replaceAll("_", " ")}</p>
                    </div>
                    <div className={styles.rowSide}><strong>{formatMoney(refund.total)}</strong></div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
        {order.adjustments.length > 0 && (
          <>
            <h2 className={styles.splitTitle}>Order adjustments</h2>
            <div className={styles.list}>
              {order.adjustments.map((adjustment, index) => (
                <Card key={`${adjustment.type}:${index}`}>
                  <div className={styles.row}>
                    <div className={styles.rowMain}>
                      <p className={styles.rowTitle}>{adjustment.type.replaceAll("_", " ")}</p>
                      <p className={styles.rowMeta}>Subtotal {formatMoney(adjustment.subtotal)} · Tax {formatMoney(adjustment.tax)}</p>
                    </div>
                    <div className={styles.rowSide}><strong>{formatMoney(adjustment.total)}</strong></div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

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
