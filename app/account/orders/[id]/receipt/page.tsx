import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintReceiptButton } from "@/components/account/PrintReceiptButton";
import { Badge, Card } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getCustomerOrderService } from "@/lib/services";
import { isWordPressAuthEnabled } from "@/lib/services";
import { formatDate, formatMoney } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { receiptDocumentTitle } from "@/lib/receiptPresentation";
import styles from "./receipt.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Purchase receipt",
  description: "Your Creative Hatti purchase receipt or order summary.",
  robots: { index: false, follow: false },
};

interface ReceiptPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { id } = await params;
  if (!isWordPressAuthEnabled()) notFound();

  let receipt;
  try {
    receipt = await getCustomerOrderService().getReceipt(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(routes.login(routes.accountOrderReceipt(id)));
    }
    return (
      <div className={styles.page}>
        <Link href={routes.accountOrder(id)} className={styles.back}>← Back to order</Link>
        <h1 className={styles.title}>Receipt unavailable</h1>
        <p className={styles.muted}>Please refresh the page or try again shortly.</p>
      </div>
    );
  }
  if (!receipt) notFound();

  const isReceipt = receipt.documentType === "receipt";
  const addressLines = [
    receipt.billing.address,
    receipt.billing.address2,
    [receipt.billing.city, receipt.billing.region].filter(Boolean).join(", "),
    [receipt.billing.postalCode, receipt.billing.country].filter(Boolean).join(" "),
  ].filter(Boolean);

  return (
    <div className={styles.page}>
      <div className={styles.actions}>
        <Link href={routes.accountOrder(id)} className={styles.back}>← Back to order</Link>
        <PrintReceiptButton label={isReceipt ? "Print Receipt" : "Print Order Summary"} />
      </div>
      <main className={styles.sheet}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <Image src="/brand/creative-hatti-logo.png" alt={SITE.name} width={200} height={49} priority />
            <span>{SITE.url}</span>
          </div>
          <div className={styles.document}>
            <h1>{receiptDocumentTitle(receipt.documentType)}</h1>
            <p>Order {receipt.number}</p>
            <p>{formatDate(receipt.date)}</p>
          </div>
        </header>

        {!isReceipt && (
          <div className={styles.pendingNotice}>
            This order is pending. This summary is not proof of payment.
          </div>
        )}

        <section className={styles.billing} aria-labelledby="billing-heading">
          <h2 id="billing-heading">Billed to</h2>
          <p>{receipt.billing.name || "Customer"}</p>
          {receipt.billing.email && <p>{receipt.billing.email}</p>}
          {addressLines.map((line, index) => <p key={`${line}:${index}`}>{line}</p>)}
        </section>

        <section className={styles.items} aria-labelledby="items-heading">
          <h2 id="items-heading">Purchased products</h2>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {receipt.items.map((item, index) => (
                  <tr key={`${item.productId}:${item.priceId ?? "base"}:${index}`}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.unitPrice)}</td>
                    <td>{formatMoney(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Card>
          <dl className={styles.totals}>
            <dt>Subtotal</dt><dd>{formatMoney(receipt.subtotal)}</dd>
            <dt>Discount</dt><dd>{receipt.discount.amount > 0 ? `−${formatMoney(receipt.discount)}` : formatMoney(receipt.discount)}</dd>
            {receipt.couponCodes.length > 0 && <><dt>Coupon{receipt.couponCodes.length > 1 ? "s" : ""}</dt><dd>{receipt.couponCodes.join(", ")}</dd></>}
            <dt>Tax</dt><dd>{formatMoney(receipt.tax)}</dd>
            <dt className={styles.totalLabel}>Total</dt><dd className={styles.totalValue}>{formatMoney(receipt.total)}</dd>
          </dl>
        </Card>

        <section className={styles.payment} aria-labelledby="payment-heading">
          <h2 id="payment-heading">Payment status</h2>
          <p><Badge variant={isReceipt ? "success" : "neutral"}>{receipt.status.replaceAll("_", " ")}</Badge></p>
          {isReceipt && receipt.paymentMethod && <p>Payment method: {receipt.paymentMethod}</p>}
          {isReceipt && receipt.transactionReference && <p>Transaction reference: <span className={styles.reference}>{receipt.transactionReference}</span></p>}
        </section>

        {receipt.refunds.length > 0 && (
          <section className={styles.refunds} aria-labelledby="refund-heading">
            <h2 id="refund-heading">Refund information</h2>
            {receipt.refunds.map((refund) => (
              <div className={styles.refund} key={refund.id}>
                <span>Refund {refund.number} · {formatDate(refund.date)} · {refund.status.replaceAll("_", " ")}</span>
                <strong>{formatMoney(refund.total)}</strong>
              </div>
            ))}
          </section>
        )}

        {(["complete", "partially_refunded"] as string[]).includes(receipt.status) && <p><Link href={routes.accountDownloads()}>Access purchased downloads</Link></p>}
        <p>Design usage rights follow the terms supplied with the product and purchased option. <Link href={routes.licenseInformation()}>License information (under review)</Link>.</p>
        <footer className={styles.footer}>Thank you for choosing {SITE.name}. {isReceipt ? "This is a purchase receipt, not a GST tax invoice." : "This order summary is not proof of payment."}</footer>
      </main>
    </div>
  );
}
