"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import type { Cart, CheckoutQuote } from "@/lib/types";
import { routes } from "@/lib/routes";
import { formatMoney } from "@/lib/utils";
import { getCheckoutParentNotice } from "@/lib/payments/checkoutParentNotice.mjs";
import { downloadFailureMessage, type DownloadFailureKind } from "@/lib/payments/downloadFailure.mjs";
import { isValidPhoneNumber, PHONE_ERROR } from "@/lib/validation/phone";
import { RazorpayCheckout, type RazorpayCheckoutHandle } from "./RazorpayCheckout";
import { getCompletedOrderDownloadUrl, getCompletedOrderDownloads, preparePendingOrder, quoteCheckout, type CheckoutOrderDownloads, type CheckoutOrderStatus, type RazorpayVerificationResult } from "./actions";
import styles from "./page.module.css";

interface CheckoutFormProps {
  cart: Cart;
  initialQuote: CheckoutQuote | null;
  initialQuoteError?: string;
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  signedIn: boolean;
  idempotencyKey: string;
  initialOrderStatus: CheckoutOrderStatus | null;
  initialOrderDownloads: CheckoutOrderDownloads | null;
  initialDownloadsError: DownloadFailureKind | null;
}

function sameQuote(left: CheckoutQuote | null, right: CheckoutQuote): boolean {
  return Boolean(left && left.currency === right.currency &&
    left.subtotal.amount === right.subtotal.amount &&
    left.discount.amount === right.discount.amount &&
    left.tax.amount === right.tax.amount &&
    left.total.amount === right.total.amount &&
    (left.discountCode ?? "") === (right.discountCode ?? ""));
}

export function CheckoutForm({
  cart, initialQuote, initialQuoteError, initialName, initialEmail, initialPhone,
  signedIn, idempotencyKey, initialOrderStatus, initialOrderDownloads, initialDownloadsError,
}: CheckoutFormProps) {
  const [quote, setQuote] = useState(initialQuote);
  const [quoteError, setQuoteError] = useState(initialQuoteError ?? "");
  const [quoteNotice, setQuoteNotice] = useState("");
  const [busy, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone || "+91 ");
  const [country, setCountry] = useState("IN");
  const [region, setRegion] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [activePreparedNumber, setActivePreparedNumber] = useState(initialOrderStatus?.order_status === "pending" ? initialOrderStatus.edd_order_reference : "");
  const [activeCompletedNumber, setActiveCompletedNumber] = useState(initialOrderStatus?.fulfilled || initialOrderStatus?.free_completed ? initialOrderStatus.edd_order_reference : "");
  const [verificationResult, setVerificationResult] = useState<RazorpayVerificationResult | null>(() => initialOrderStatus && ["authorized", "captured"].includes(initialOrderStatus.payment_status)
    ? { status: initialOrderStatus.payment_status as "authorized" | "captured", verified: true, fulfilled: initialOrderStatus.fulfilled, edd_order_reference: initialOrderStatus.edd_order_reference }
    : null);
  const [initialPaymentFailed] = useState(initialOrderStatus?.payment_status === "failed");
  const [completedDownloads, setCompletedDownloads] = useState(initialOrderDownloads);
  const [downloadsError, setDownloadsError] = useState<DownloadFailureKind | null>(initialDownloadsError);
  const [downloadingFile, setDownloadingFile] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const paymentRef = useRef<RazorpayCheckoutHandle>(null);

  const downloadPurchasedFile = async (orderReference: string, orderItemId: number, fileKey: string) => {
    const actionKey = `${orderItemId}:${fileKey}`;
    if (downloadingFile) return;
    setDownloadingFile(actionKey);
    setDownloadError("");
    try {
      const result = await getCompletedOrderDownloadUrl(orderReference, orderItemId, fileKey);
      if (!result.url) { setDownloadError(downloadFailureMessage(result.error ?? "temporary")); return; }
      window.location.assign(result.url);
    } catch {
      setDownloadError(downloadFailureMessage("temporary"));
    } finally {
      setDownloadingFile("");
    }
  };

  const currentPreparedNumber = activePreparedNumber;
  const currentCompletedNumber = activeCompletedNumber;
  const paymentNotice = getCheckoutParentNotice(verificationResult);
  const nameError = nameTouched && fullName.trim().length < 2 ? "Enter your full name." : undefined;
  const emailError = emailTouched && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? "Enter a valid email address." : undefined;
  const phoneError = phoneTouched && !isValidPhoneNumber(phone) ? PHONE_ERROR : undefined;

  const updateTotals = () => {
    setQuoteError("");
    setQuoteNotice("");
    setPhoneTouched(true);
    if (!isValidPhoneNumber(phone)) { setQuoteError(PHONE_ERROR); return; }
    startTransition(async () => {
      const result = await quoteCheckout({ country, region, phone, discountCode });
      if (result.quote) setQuote(result.quote);
      else setQuoteError(result.error ?? "Could not calculate totals.");
    });
  };

  const submitCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || busy || currentPreparedNumber || currentCompletedNumber) return;
    setCheckoutError("");
    setQuoteError("");
    setQuoteNotice("");
    setPhoneTouched(true);
    if (!isValidPhoneNumber(phone)) { setQuoteError(PHONE_ERROR); return; }

    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitting(true);
    try {
      // Recheck EDD pricing immediately before preparation so changed coupon or
      // billing details cannot silently use an older displayed total.
      const latest = await quoteCheckout({ country, region, phone, discountCode });
      if (!latest.quote) {
        setQuoteError(latest.error ?? "Could not calculate checkout totals.");
        return;
      }
      if (!sameQuote(quote, latest.quote)) {
        setQuote(latest.quote);
        setQuoteNotice("Totals have been updated by EDD. Review the amount and click the checkout button again to continue.");
        return;
      }

      const prepared = await preparePendingOrder(formData);
      if (!prepared.order) {
        setCheckoutError(prepared.error ?? "Could not prepare checkout. Please try again.");
        return;
      }
      if (prepared.order.status === "complete") {
        setActiveCompletedNumber(prepared.order.number);
        const downloads = await getCompletedOrderDownloads(prepared.order.number);
        setCompletedDownloads(downloads.downloads);
        setDownloadsError(downloads.error);
        setVerificationResult(null);
        window.history.replaceState(null, "", `${routes.checkout()}?completed=${encodeURIComponent(prepared.order.number)}`);
        return;
      }
      if (prepared.order.total.currency !== latest.quote.total.currency || prepared.order.total.amount !== latest.quote.total.amount) {
        setCheckoutError("EDD returned a different order total. Refresh checkout to review the current price before paying.");
        return;
      }

      setActivePreparedNumber(prepared.order.number);
      window.history.replaceState(null, "", `${routes.checkout()}?prepared=${encodeURIComponent(prepared.order.number)}`);
      await paymentRef.current?.startCheckout(prepared.order.number);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Checkout could not be prepared. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.layout}>
      <div className={styles.form}>
        {!currentPreparedNumber && !currentCompletedNumber && <p className={styles.progress} aria-label="Checkout progress"><strong>1. Billing details</strong><span>2. Secure payment</span></p>}
        {currentCompletedNumber ? (
          <section className={styles.pendingNotice} role="status">
            <h2 className={styles.sectionHeading}>{paymentNotice?.kind === "complete" ? paymentNotice.title : "Free order complete"}</h2>
            <p>Order reference <strong>{currentCompletedNumber}</strong> is complete. {paymentNotice?.kind === "complete" ? paymentNotice.message : "EDD recorded the zero-value order and enabled its authorized download entitlements."}</p>
            {!verificationResult?.fulfilled && <p>No payment was taken.</p>}
            {completedDownloads?.items.length ? <div className={styles.completedDownloads}>
              <h3 className={styles.downloadHeading}>Your purchased files</h3>
              {completedDownloads.items.map((item) => <section className={styles.downloadProduct} key={item.order_item_id}>
                <h4>{item.title}</h4>
                <ul>{item.files.map((file) => <li key={`${item.order_item_id}:${file.key}`}>
                  <button type="button" className={styles.downloadButton} disabled={Boolean(downloadingFile)} onClick={() => void downloadPurchasedFile(currentCompletedNumber, item.order_item_id, file.key)}>
                    {downloadingFile === `${item.order_item_id}:${file.key}` ? "Preparing download…" : `Download ${file.name}`}
                  </button>
                </li>)}</ul>
              </section>)}
              <p>Download links are created when you click and may expire. If one expires, return here and request a fresh link.</p>
              {downloadError && <p role="alert" className={styles.error}>{downloadError}</p>}
            </div> : <p>{downloadFailureMessage(downloadsError ?? "temporary")}</p>}
            <p>Optional: <Link href={routes.claimAccount()}>Claim your purchase for an account</Link>. We will verify your email before linking purchases; no account is created automatically.</p>
          </section>
        ) : paymentNotice?.kind === "fulfillment-pending" ? (
          <section className={styles.pendingNotice} role="status">
            <h2 className={styles.sectionHeading}>{paymentNotice.title}</h2>
            <p>Payment was captured for order <strong>{verificationResult?.edd_order_reference}</strong>. {paymentNotice.message}</p>
          </section>
        ) : paymentNotice?.kind === "authorized" ? (
          <section className={styles.pendingNotice} role="status">
            <h2 className={styles.sectionHeading}>{paymentNotice.title}</h2>
            <p>Payment for order <strong>{verificationResult?.edd_order_reference}</strong> is {paymentNotice.message.slice("Payment is ".length)}</p>
          </section>
        ) : currentPreparedNumber ? (
          <section className={styles.pendingNotice} role="status">
            <h2 className={styles.sectionHeading}>Order ready for payment</h2>
            <p>Order reference <strong>{currentPreparedNumber}</strong> is pending. {initialPaymentFailed ? "The previous payment attempt failed; you can retry securely with Razorpay." : "Continue securely with Razorpay to pay; downloads remain unavailable until payment verification and fulfillment."}</p>
          </section>
        ) : (
          <form onSubmit={submitCheckout} className={styles.form} onInvalidCapture={() => { setNameTouched(true); setEmailTouched(true); setPhoneTouched(true); }}>
            <section aria-labelledby="customer-information" className={styles.section}>
              <h2 id="customer-information" className={styles.sectionHeading}>Billing details</h2>
              <div className={styles.fields}>
                <Input label="Billing name" name="fullName" autoComplete="name" autoCapitalize="words" required minLength={2} maxLength={120} value={fullName} error={nameError} onBlur={() => setNameTouched(true)} onChange={(event) => setFullName(event.target.value)} />
                <Input label="Email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" required maxLength={254} value={email} readOnly={signedIn} error={emailError} onBlur={() => setEmailTouched(true)} onChange={(event) => setEmail(event.target.value)} hint={signedIn ? "Using the email on your signed-in account." : undefined} />
                <Input label="Mobile phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" autoCapitalize="none" required maxLength={32} value={phone} error={phoneError} onBlur={() => setPhoneTouched(true)} onChange={(event) => setPhone(event.target.value)} hint="Include your country calling code, for example +91 98765 43210. No SMS verification is required." />
                {quote?.taxesEnabled && <div className={styles.fieldRow}>
                  <Input label="Country code" name="country" autoComplete="country" required maxLength={2} value={country} onChange={(event) => setCountry(event.target.value.toUpperCase())} hint="Use the two-letter country code, for example IN." />
                  <Input label="State or region" name="region" autoComplete="address-level1" required maxLength={100} value={region} onChange={(event) => setRegion(event.target.value)} />
                </div>}
                {!quote?.taxesEnabled && <>
                  <input type="hidden" name="country" value={country} />
                  <input type="hidden" name="region" value={region} />
                </>}
                <Input label="Discount code" name="discountCode" autoComplete="off" maxLength={64} value={discountCode} onChange={(event) => setDiscountCode(event.target.value.toUpperCase())} hint="Optional. EDD checks the code and its eligibility." />
                <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
              </div>
              <div className={styles.quoteActions}>
                <Button type="button" variant="secondary" onClick={updateTotals} loading={busy} disabled={busy || submitting}>Update totals</Button>
              </div>
              {quoteError && <p role="alert" className={styles.error}>{quoteError}</p>}
              {quoteNotice && <p role="status" className={styles.notice}>{quoteNotice}</p>}
              {checkoutError && <p role="alert" className={styles.error}>{checkoutError}</p>}
            </section>

            <label className={styles.terms}>
              <input type="checkbox" name="terms" value="accepted" required className={styles.checkbox} />
              <span>I agree to the <Link href={routes.terms()}>Terms</Link> and <Link href={routes.privacy()}>Privacy Policy</Link>.</span>
            </label>
            <Button className={styles.mobileAction} type="submit" size="lg" fullWidth loading={submitting} disabled={!quote || Boolean(quoteError) || busy || submitting}>
              {quote?.total.amount === 0 ? "Complete Free Order" : quote ? `Pay ${formatMoney(quote.total)} Securely` : "Checkout totals unavailable"}
            </Button>
            <p className={styles.methodHint}>{quote?.total.amount === 0
              ? "EDD completes zero-value orders without Razorpay and grants only its normal download entitlements."
              : "Your payment is processed securely by Razorpay. Downloads are enabled only after payment verification and fulfillment."}</p>
          </form>
        )}
        {!currentCompletedNumber && <RazorpayCheckout ref={paymentRef} orderReference={currentPreparedNumber} name={fullName || initialName} email={email || initialEmail} phone={phone || initialPhone} initialVerification={initialOrderStatus && ["authorized", "captured"].includes(initialOrderStatus.payment_status) ? verificationResult : null} onVerified={(result) => {
          setVerificationResult(result);
          if (result.fulfilled) {
            setActiveCompletedNumber(result.edd_order_reference);
            void getCompletedOrderDownloads(result.edd_order_reference).then((downloads) => {
              setCompletedDownloads(downloads.downloads);
              setDownloadsError(downloads.error);
            });
          }
        }} />}
      </div>

      <aside className={styles.side} aria-label="Order summary">
        <section className={styles.summary}>
          <h2 className={styles.sectionHeading}>Order summary</h2>
          <ul className={styles.lines}>
            {cart.items.map((item) => <li key={item.key} className={styles.line}>
              <span className={styles.lineTitle}>{item.title}
                <span className={styles.lineLicense}>{item.optionName || "Standard option"}{item.quantity > 1 ? ` · Qty ${item.quantity}` : ""}</span>
              </span>
              <span className={styles.linePrice}>{formatMoney(item.lineTotal)}</span>
            </li>)}
          </ul>
          {quote ? <dl className={styles.totals} aria-live="polite">
            <div className={styles.totalRow}><dt>Subtotal</dt><dd>{formatMoney(quote.subtotal)}</dd></div>
            {quote.discount.amount > 0 && <div className={styles.totalRow}><dt>Discount{quote.discountCode ? ` (${quote.discountCode})` : ""}</dt><dd>−{formatMoney(quote.discount)}</dd></div>}
            <div className={styles.totalRow}><dt>Tax</dt><dd>{formatMoney(quote.tax)}</dd></div>
            <div className={`${styles.totalRow} ${styles.grandTotal}`}><dt>Total</dt><dd>{formatMoney(quote.total)}</dd></div>
          </dl> : <p role="status">{quoteError || "Checkout totals are being calculated by EDD."}</p>}
          <p className={styles.methodHint}>Prices, discounts and totals are confirmed by EDD.</p>
        </section>
      </aside>
    </div>
  );
}
