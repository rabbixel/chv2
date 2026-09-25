import type { Metadata } from "next";
import { Button, EmptyState } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import styles from "../section.module.css";

export const metadata: Metadata = {
  title: "Licenses",
  description: "Your Creative Hatti licenses.",
  alternates: { canonical: `${SITE.url}/account/licenses` },
};

export default async function AccountLicensesPage() {
  return (
    <div>
      <h1 className={styles.title}>Licenses</h1>
      <p className={styles.lede}>
        What each purchase allows you to do, in plain words.
      </p>
      <EmptyState
        title="No licenses yet"
        description="Licenses from your orders will appear here, each linked to its invoice."
        action={<Button href={routes.accountOrders()}>View orders</Button>}
      />
      <p className={styles.note}>
        Questions about usage? Read the license terms on any product page.
      </p>
    </div>
  );
}
