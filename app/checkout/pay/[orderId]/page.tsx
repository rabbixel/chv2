import type { Metadata } from "next";
import { Breadcrumbs, Container } from "@/components/layout";
import { Button } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Payment pending",
  alternates: { canonical: `${SITE.url}/checkout` },
  robots: { index: false, follow: false },
};

export default async function PaymentPendingPage() {
  return <Container size="narrow"><div className={styles.page}>
    <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Checkout", href: routes.checkout() }, { label: "Payment pending" }]} />
    <h1 className={styles.title}>Payment is not available yet</h1>
    <section className={styles.outcome}>
      <p>Pending orders cannot be paid or completed through this page. No payment has been taken and download access has not been granted.</p>
      <Button href={routes.checkout()}>Return to checkout</Button>
    </section>
  </div></Container>;
}
