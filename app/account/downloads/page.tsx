import type { Metadata } from "next";
import Link from "next/link";
import { DownloadButton } from "@/components/account";
import { Button, Card, EmptyState } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getDownloadService, getOrderService } from "@/lib/services";
import { formatDate, formatFileSize } from "@/lib/utils";
import styles from "../section.module.css";

export const metadata: Metadata = {
  title: "Downloads",
  description: "Your Creative Hatti downloads.",
  alternates: { canonical: `${SITE.url}/account/downloads` },
};

export default async function AccountDownloadsPage() {
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
