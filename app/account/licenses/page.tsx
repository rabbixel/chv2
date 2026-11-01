import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { licenseOrderLinkId } from "@/lib/customerLicensePresentation";
import { getCustomerLicenseService, getLicenseService, isWordPressAuthEnabled } from "@/lib/services";
import type { Paginated, CustomerLicense } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import styles from "../section.module.css";

export const metadata: Metadata = {
  title: "Licenses",
  description: "Your Creative Hatti licenses.",
  alternates: { canonical: `${SITE.url}/account/licenses` },
};

export const dynamic = "force-dynamic";

interface AccountLicensesPageProps {
  searchParams: Promise<{ page?: string | string[] }>;
}

export default async function AccountLicensesPage({ searchParams }: AccountLicensesPageProps) {
  if (isWordPressAuthEnabled()) {
    const query = await searchParams;
    const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
    const page = rawPage && /^[1-9][0-9]{0,4}$/.test(rawPage) ? Number(rawPage) : 1;
    let licenses: Paginated<CustomerLicense>;
    try {
      licenses = await getCustomerLicenseService().list({ page, pageSize: 20 });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirect(routes.login(routes.accountLicenses()));
      }
      return <div><h1 className={styles.title}>Licenses</h1><EmptyState title="Licenses could not be loaded" description="Please refresh the page or try again shortly." /></div>;
    }
    return <WordPressLicenses licenses={licenses} />;
  }

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

function WordPressLicenses({ licenses }: { licenses: Paginated<CustomerLicense> }) {
  return (
    <div>
      <h1 className={styles.title}>License records</h1>
      <p className={styles.lede}>These are optional software activation records, not the usage licenses for your purchased artwork. Your design usage rights are determined by the product terms and purchased option shown in your order details.</p>
      {licenses.items.length === 0 ? (
        <EmptyState title="No software license records" description="No software activation records are associated with your account. Design usage rights follow the terms supplied with your purchased product and option." action={<Button href={routes.accountOrders()}>View orders</Button>} />
      ) : (
        <>
          <div className={styles.list}>
            {licenses.items.map((license) => (
              <Card key={license.id}>
                <div className={styles.row}>
                  <div className={styles.rowMain}>
                    <p className={styles.rowTitle}>
                      {license.productUrl ? <Link href={license.productUrl}>{license.productTitle}</Link> : license.productTitle}
                    </p>
                    {license.maskedKey && <p className={styles.mono}>{license.maskedKey}</p>}
                    <p className={styles.rowMeta}>
                      {licenseOrderLinkId(license.purchaseType, license.purchaseId) && license.purchaseNumber
                        ? <>Order <Link href={routes.accountOrder(licenseOrderLinkId(license.purchaseType, license.purchaseId)!)}>{license.purchaseNumber}</Link></>
                        : license.purchaseType === "legacy_payment" && license.purchaseId
                          ? `Previous payment #${license.purchaseId}`
                          : "Purchase reference unavailable"}
                      {license.activationCount > 0 ? ` · ${license.activationCount} software activations` : ""}
                      {license.lifetime ? " · Software key: lifetime" : license.expiresAt ? ` · Software key expires ${formatDate(license.expiresAt)}` : ""}
                    </p>
                  </div>
                  <div className={styles.rowSide}>
                    <Badge variant={license.status === "active" ? "success" : "neutral"}>{license.status === "inactive" ? "Not activated" : license.status === "active" ? "Activated" : `Software: ${license.status}`}</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {licenses.pagination.totalPages > 1 && (
            <nav aria-label="License pages" className={styles.row}>
              {licenses.pagination.hasPrevPage ? <Link href={`${routes.accountLicenses()}?page=${licenses.pagination.page - 1}`}>Previous</Link> : <span />}
              <span className={styles.rowMeta}>Page {licenses.pagination.page} of {licenses.pagination.totalPages}</span>
              {licenses.pagination.hasNextPage ? <Link href={`${routes.accountLicenses()}?page=${licenses.pagination.page + 1}`}>Next</Link> : <span />}
            </nav>
          )}
        </>
      )}
      <p className={styles.note}>Software activation status does not indicate whether a completed artwork purchase is licensed for use. Keys are masked; activation and management are not available here. See your order details for the purchased design license.</p>
    </div>
  );
}
