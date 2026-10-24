import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountProductArtwork, CustomerDownloadActions, DownloadButton, PurchaseRecoveryPrompt } from "@/components/account";
import { ApiError } from "@/lib/api/client";
import { Button, Card, EmptyState } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { resolveProductImagesByUrl } from "@/lib/services/productService";
import {
  getCustomerDownloadService,
  getDownloadService,
  getOrderService,
  isWordPressAuthEnabled,
} from "@/lib/services";
import type { CustomerDownloadPurchase, Paginated, ProductImage } from "@/lib/types";
import { formatDate, formatFileSize } from "@/lib/utils";
import styles from "../section.module.css";

export const metadata: Metadata = {
  title: "Downloads",
  description: "Your Creative Hatti downloads.",
  alternates: { canonical: `${SITE.url}/account/downloads` },
};

export const dynamic = "force-dynamic";

interface AccountDownloadsPageProps {
  searchParams: Promise<{ page?: string | string[]; recovered?: string | string[] }>;
}

export default async function AccountDownloadsPage({ searchParams }: AccountDownloadsPageProps) {
  const query = await searchParams;
  const recovered = query.recovered === "1";

  if (isWordPressAuthEnabled()) {
    const pageValue = Array.isArray(query.page) ? query.page[0] : query.page;
    const page = pageValue && /^[1-9][0-9]{0,4}$/.test(pageValue) ? Number(pageValue) : 1;
    let downloads: Paginated<CustomerDownloadPurchase>;
    try {
      downloads = await getCustomerDownloadService().list({ page, pageSize: 20 });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirect(routes.login(routes.accountDownloads()));
      }
      return (
        <div>
          <h1 className={styles.title}>Downloads</h1>
          <EmptyState title="Downloads could not be loaded" description="Please refresh the page or try again shortly." />
        </div>
      );
    }
    const productImages = await resolveProductImagesByUrl(
      downloads.items.flatMap((purchase) => purchase.items.map((item) => item.productUrl)),
    );
    return <WordPressDownloads downloads={downloads} productImages={productImages} recovered={recovered} />;
  }

  const downloads = await getDownloadService().listDownloads();
  const orderService = getOrderService();
  const purchaseDates = new Map<string, string>();
  await Promise.all(
    downloads.map(async (download) => {
      const order = await orderService.getOrderById(download.orderId);
      purchaseDates.set(download.id, order?.createdAt ?? download.createdAt);
    }),
  );

  return (
    <div>
      <h1 className={styles.title}>Downloads</h1>
      {recovered && <p role="status" className={styles.notice}>Your previous purchases are connected to your account. <Link href={routes.accountDownloads()}>View Account Downloads</Link> or choose an available file below.</p>}
      <PurchaseRecoveryPrompt />
      <p className={styles.lede}>
        Your files, ready whenever inspiration strikes.
      </p>
      {downloads.length === 0 ? (
        <EmptyState
          title="No downloads yet"
          description="Files from your paid orders will appear here."
          action={<Button href={routes.accountOrders()}>View orders</Button>}
        />
      ) : (
        <div className={styles.list}>
          {downloads.map((download) => {
            const remaining =
              download.downloadLimit - download.downloadCount;
            return (
              <Card key={download.id}>
                <div className={styles.row}>
                  <div className={styles.rowMain}>
                    <p className={styles.rowTitle}>
                      <Link href={routes.product(download.productSlug)}>
                        {download.productTitle}
                      </Link>
                    </p>
                    <p className={styles.rowMeta}>
                      {download.fileName} ·{" "}
                      {formatFileSize(download.fileSizeBytes)}
                    </p>
                    <p className={styles.rowMeta}>
                      Purchased{" "}
                      {formatDate(purchaseDates.get(download.id) ?? download.createdAt)} ·{" "}
                      {remaining} of {download.downloadLimit} downloads left
                      {download.accessExpiresAt
                        ? ` · Access until ${formatDate(download.accessExpiresAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className={styles.rowSide}>
                    <DownloadButton
                      productId={download.productId}
                      orderId={download.orderId}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <p className={styles.note}>
        Each click mints a fresh, short-lived link — links are never stored
        or shared.
      </p>
    </div>
  );
}

function WordPressDownloads({
  downloads,
  productImages,
  recovered,
}: {
  downloads: Paginated<CustomerDownloadPurchase>;
  productImages: Map<string, ProductImage>;
  recovered: boolean;
}) {
  const entries = downloads.items.flatMap((purchase) =>
    purchase.items.map((item) => ({ purchase, item })),
  );

  return (
    <div>
      <h1 className={styles.title}>Downloads</h1>
      {recovered && <p role="status" className={styles.notice}>Your previous purchases are connected to your account. <Link href={routes.accountDownloads()}>View Account Downloads</Link> or choose an available file below.</p>}
      <PurchaseRecoveryPrompt />
      <p className={styles.lede}>Your purchased products and download availability.</p>
      {entries.length === 0 ? (
        <EmptyState
          title="No downloads yet"
          description="Products from your completed purchases will appear here."
          action={<Button href={routes.accountOrders()}>View orders</Button>}
        />
      ) : (
        <>
          <div className={styles.list}>
            {entries.map(({ purchase, item }) => (
              <Card key={item.orderItemId}>
                <div className={`${styles.row} ${styles.purchaseRow}`}>
                  <AccountProductArtwork
                    title={item.title}
                    image={item.productUrl ? productImages.get(item.productUrl) : undefined}
                    fallbackUrl={item.thumbnailUrl}
                  />
                  <div className={styles.rowMain}>
                    <p className={styles.rowTitle}>
                      {item.productUrl ? <Link href={item.productUrl}>{item.title}</Link> : item.title}
                    </p>
                    <p className={styles.rowMeta}>
                      Purchased {formatDate(purchase.purchaseDate)} · Order{" "}
                      <Link href={routes.accountOrder(purchase.orderId)}>{purchase.orderNumber}</Link>
                    </p>
                    <p className={styles.rowMeta}>
                      Qty {item.quantity}{item.priceId !== null ? ` · Price option ${item.priceId}` : ""}
                      {item.availability === "available" && ` · ${item.entitledFileCount} file${item.entitledFileCount === 1 ? "" : "s"} available`}
                    </p>
                  </div>
                  <div className={styles.purchaseActions}><CustomerDownloadActions item={item} /></div>
                </div>
              </Card>
            ))}
          </div>
          {downloads.pagination.totalPages > 1 && (
            <nav aria-label="Download library pages" className={styles.row}>
              {downloads.pagination.hasPrevPage ? <Link href={`${routes.accountDownloads()}?page=${downloads.pagination.page - 1}`}>Previous</Link> : <span />}
              <span className={styles.rowMeta}>Page {downloads.pagination.page} of {downloads.pagination.totalPages}</span>
              {downloads.pagination.hasNextPage ? <Link href={`${routes.accountDownloads()}?page=${downloads.pagination.page + 1}`}>Next</Link> : <span />}
            </nav>
          )}
        </>
      )}
      <p className={styles.note}>Each button requests a fresh EDD-authorized link. Download limits and access rules still apply. EDD authorization does not confirm that the corresponding S3 object exists.</p>
    </div>
  );
}
