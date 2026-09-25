import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getLicenseService } from "@/lib/services";
import { formatDate } from "@/lib/utils";
import styles from "../section.module.css";

export const metadata: Metadata = {
  title: "Licenses",
  description: "Your Creative Hatti licenses.",
  alternates: { canonical: `${SITE.url}/account/licenses` },
};

export default async function AccountLicensesPage() {
  const owned = await getLicenseService().listOwnedLicenses();
  const definitions = await getLicenseService().listLicenses();
  const nameByCode = new Map(definitions.map((entry) => [entry.code, entry.name]));

  return (
    <div>
      <h1 className={styles.title}>Licenses</h1>
      <p className={styles.lede}>
        What each purchase allows you to do, in plain words.
      </p>
      {owned.length === 0 ? (
        <EmptyState
          title="No licenses yet"
          description="Licenses from your orders will appear here, each linked to its invoice."
          action={<Button href={routes.accountOrders()}>View orders</Button>}
        />
      ) : (
        <div className={styles.list}>
          {owned.map((entry) => (
            <Card key={entry.id}>
              <div className={styles.row}>
                <div className={styles.rowMain}>
                  <p className={styles.rowTitle}>
                    <Link href={routes.product(entry.productSlug)}>
                      {entry.productTitle}
                    </Link>
                  </p>
                  <p className={styles.mono}>{entry.key}</p>
                  <p className={styles.rowMeta}>
                    {nameByCode.get(entry.license) ?? entry.license} · Order{" "}
                    <Link href={routes.accountOrder(entry.orderId)}>
                      {entry.orderNumber}
                    </Link>{" "}
                    · Issued {formatDate(entry.issuedAt)}
                    {entry.expiresAt
                      ? ` · Expires ${formatDate(entry.expiresAt)}`
                      : ""}
                    {entry.activationsLimit !== undefined &&
                    entry.activationsUsed !== undefined
                      ? ` · ${entry.activationsUsed} of ${entry.activationsLimit} activations used`
                      : ""}
                  </p>
                </div>
                <div className={styles.rowSide}>
                  <Badge
                    variant={entry.status === "active" ? "success" : "neutral"}
                  >
                    {entry.status}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className={styles.note}>
        Questions about usage? Read the license terms on any product page.
      </p>
    </div>
  );
}
