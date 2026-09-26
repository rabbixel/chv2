import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, Container } from "@/components/layout";
import { CartSummary } from "@/components/cart";
import { SubmitButton } from "@/components/checkout";
import { Button, EmptyState, Input } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getCartService } from "@/lib/services";
import type { LicenseCode } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { applyCoupon, removeCoupon } from "../cart/actions";
import { placeOrder } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: `Complete your Creative Hatti order with secure Razorpay payment.`,
  alternates: { canonical: `${SITE.url}/checkout` },
  robots: { index: false, follow: false },
};

const LICENSE_LABELS: Record<LicenseCode, string> = {
  personal: "Personal",
  commercial: "Commercial",
  extended: "Extended",
};

interface CheckoutPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(
  query: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const value = query[name];
  return typeof value === "string" ? value : null;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const cart = await getCartService().getSessionCart();
  const query = (await searchParams) ?? {};
  const error = firstParam(query, "error");
  const coupon = firstParam(query, "coupon");
  const couponCode = firstParam(query, "code");

  if (cart.items.length === 0) {
    return (
      <Container size="narrow">
        <div className={styles.page}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Cart", href: routes.cart() },
              { label: "Checkout" },
            ]}
          />
          <EmptyState
            headingLevel="h1"
            title="Your cart is empty"
            description="Add a download or two before checking out."
            action={<Button href={routes.search()}>Browse products</Button>}
          />
        </div>
      </Container>
    );
  }

  const mockPayments = process.env.USE_MOCK_API !== "false";

  return (
    <Container>
      <div className={styles.page}>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Cart", href: routes.cart() },
            { label: "Checkout" },
          ]}
        />
        <h1 className={styles.title}>Checkout</h1>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {coupon === "applied" && (
          <p role="status" className={styles.notice}>
            Coupon{couponCode ? ` ${couponCode}` : ""} applied.
          </p>
        )}
        {coupon === "removed" && (
          <p role="status" className={styles.notice}>
            Coupon removed.
          </p>
        )}
        {coupon === "invalid" && (
          <p role="alert" className={styles.error}>
            Coupon{couponCode ? ` "${couponCode}"` : ""} is not valid.
          </p>
        )}
        <div className={styles.layout}>
          <form action={placeOrder} className={styles.form}>
            <section
              aria-labelledby="customer-information"
              className={styles.section}
            >
              <h2 id="customer-information" className={styles.sectionHeading}>
                Customer information
              </h2>
              <div className={styles.fields}>
                <Input
                  label="Full name"
                  name="fullName"
                  autoComplete="name"
                  required
                />
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
                <Input
                  label="Phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                />
              </div>
            </section>

            <section
              aria-labelledby="billing-address"
              className={styles.section}
            >
              <h2 id="billing-address" className={styles.sectionHeading}>
                Billing address <span className={styles.optional}>(optional)</span>
              </h2>
              <div className={styles.fields}>
                <Input
                  label="Address"
                  name="line1"
                  autoComplete="address-line1"
                />
                <div className={styles.fieldRow}>
                  <Input label="City" name="city" autoComplete="address-level2" />
                  <Input
                    label="State"
                    name="state"
                    autoComplete="address-level1"
                  />
                </div>
                <div className={styles.fieldRow}>
                  <Input
                    label="PIN code"
                    name="postalCode"
                    autoComplete="postal-code"
                  />
                  <Input
                    label="Country"
                    name="country"
                    autoComplete="country-name"
                    defaultValue="India"
                  />
                </div>
              </div>
            </section>

            <section
              aria-labelledby="payment-method"
              className={styles.section}
            >
              <h2 id="payment-method" className={styles.sectionHeading}>
                Payment method
              </h2>
              <label className={styles.method}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="razorpay"
                  defaultChecked
                  required
                  className={styles.radio}
                />
                <span className={styles.methodBody}>
                  <span className={styles.methodName}>Razorpay</span>
                  <span className={styles.methodHint}>
                    UPI, cards and netbanking — you complete payment securely
                    after placing your order.
                    {mockPayments && (
                      <> Test mode — no real payment will be processed.</>
                    )}
                  </span>
                </span>
              </label>
            </section>

            <label className={styles.terms}>
              <input
                type="checkbox"
                name="terms"
                value="accepted"
                required
                className={styles.checkbox}
              />
              <span>
                I agree to the <Link href={routes.terms()}>Terms</Link> and{" "}
                <Link href={routes.privacy()}>Privacy Policy</Link>.
              </span>
            </label>

            <SubmitButton size="lg" fullWidth pendingLabel="Placing order…">
              Place order · {formatMoney(cart.total)}
            </SubmitButton>
          </form>

          <div className={styles.side}>
            <section
              aria-labelledby="order-summary"
              className={styles.summary}
            >
              <h2 id="order-summary" className={styles.sectionHeading}>
                Order summary
              </h2>
              <ul className={styles.lines}>
                {cart.items.map((item) => (
                  <li key={item.key} className={styles.line}>
                    <span className={styles.lineTitle}>
                      {item.title}
                      <span className={styles.lineLicense}>
                        {LICENSE_LABELS[item.license]} licence
                      </span>
                    </span>
                    <span className={styles.linePrice}>
                      {formatMoney(item.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>
              {cart.couponCode ? (
                <div className={styles.couponApplied}>
                  <p className={styles.couponText}>
                    Coupon {cart.couponCode} applied
                  </p>
                  <form action={removeCoupon}>
                    <button type="submit" className={styles.couponRemove}>
                      Remove
                    </button>
                  </form>
                </div>
              ) : (
                <form action={applyCoupon} className={styles.couponForm}>
                  <Input label="Coupon code" name="coupon" hideLabel />
                  <SubmitButton pendingLabel="Applying…">Apply</SubmitButton>
                </form>
              )}
              <CartSummary cart={cart} action={null} />
            </section>
          </div>
        </div>
      </div>
    </Container>
  );
}
