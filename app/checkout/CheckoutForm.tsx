"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { SubmitButton } from "@/components/checkout";
import type { Cart, CheckoutQuote } from "@/lib/types";
import { routes } from "@/lib/routes";
import { formatMoney } from "@/lib/utils";
import { preparePendingOrder, quoteCheckout } from "./actions";
import styles from "./page.module.css";

interface CheckoutFormProps {
  cart: Cart;
  initialQuote: CheckoutQuote | null;
  initialQuoteError?: string;
  initialName: string;
  initialEmail: string;
  signedIn: boolean;
  idempotencyKey: string;
  preparedNumber?: string;
}

export function CheckoutForm({
  cart, initialQuote, initialQuoteError, initialName, initialEmail,
  signedIn, idempotencyKey, preparedNumber,
}: CheckoutFormProps) {
  const [quote, setQuote] = useState(initialQuote);
  const [quoteError, setQuoteError] = useState(initialQuoteError ?? "");
  const [busy, startTransition] = useTransition();
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [country, setCountry] = useState("IN");
  const [region, setRegion] = useState("");
  const [discountCode, setDiscountCode] = useState("");

  const updateTotals = () => {
    setQuoteError("");
    startTransition(async () => {
      const result = await quoteCheckout({ country, region, discountCode });
      if (result.quote) setQuote(result.quote);
      else setQuoteError(result.error ?? "Could not calculate totals.");
    });
  };

  return (
    <div className={styles.layout}>
      <div className={styles.form}>
        {preparedNumber ? (
          <section className={styles.pendingNotice} role="status">
            <h2 className={styles.sectionHeading}>Order prepared</h2>
            <p>Order reference <strong>{preparedNumber}</strong> is pending. No payment has been taken and no downloads are available yet.</p>
            <p>Payment will only be available after a verified payment step is implemented.</p>
          </section>
        ) : (
          <form action={preparePendingOrder} className={styles.form}>
            <section aria-labelledby="customer-information" className={styles.section}>
              <h2 id="customer-information" className={styles.sectionHeading}>Billing details</h2>
              <div className={styles.fields}>
                <Input label="Full name" name="fullName" autoComplete="name" required minLength={2} maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} />
                <Input label="Email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} readOnly={signedIn} onChange={(event) => setEmail(event.target.value)} hint={signedIn ? "Using the email on your signed-in account." : undefined} />
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
                <Button type="button" variant="secondary" onClick={updateTotals} loading={busy} disabled={busy}>Update totals</Button>
              </div>
              {quoteError && <p role="alert" className={styles.error}>{quoteError}</p>}
            </section>

            <label className={styles.terms}>
              <input type="checkbox" name="terms" value="accepted" required className={styles.checkbox} />
              <span>I agree to the <Link href={routes.terms()}>Terms</Link> and <Link href={routes.privacy()}>Privacy Policy</Link>.</span>
            </label>
            {quote?.total.amount === 0 ? (
              <p role="alert" className={styles.error}>This order totals zero. It cannot be prepared as a paid pending order; free-order completion needs a separate verified flow.</p>
            ) : (
              <SubmitButton size="lg" fullWidth pendingLabel="Preparing order…" disabled={!quote || Boolean(quoteError)}>Create pending order</SubmitButton>
            )}
            <p className={styles.methodHint}>Creating this pending order does not take payment or grant download access.</p>
          </form>
        )}
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
          {quote ? <dl className={styles.totals}>
            <div className={styles.totalRow}><dt>Subtotal</dt><dd>{formatMoney(quote.subtotal)}</dd></div>
            {quote.discount.amount > 0 && <div className={styles.totalRow}><dt>Discount{quote.discountCode ? ` (${quote.discountCode})` : ""}</dt><dd>−{formatMoney(quote.discount)}</dd></div>}
            <div className={styles.totalRow}><dt>Tax</dt><dd>{formatMoney(quote.tax)}</dd></div>
            <div className={`${styles.totalRow} ${styles.grandTotal}`}><dt>Total</dt><dd>{formatMoney(quote.total)}</dd></div>
          </dl> : <p role="status">Checkout totals are being calculated by EDD.</p>}
          <p className={styles.methodHint}>Digital products are delivered only after payment is verified and the order is completed.</p>
        </section>
      </aside>
    </div>
  );
}
