import type { Metadata } from "next";
import { Button, Card, EmptyState } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getDownloadService } from "@/lib/services";
import { formatFileSize } from "@/lib/utils";
import styles from "../section.module.css";

export const metadata: Metadata = {
  title: "Downloads",
  description: "Your Creative Hatti downloads.",
  alternates: { canonical: `${SITE.url}/account/downloads` },
};

export default async function AccountDownloadsPage() {
  const downloads = await getDownloadService().listDownloads();

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
          {downloads.map((download) => (
            <Card key={download.id}>
              <div className={styles.row}>
                <div className={styles.rowMain}>
                  <p className={styles.rowTitle}>{download.productTitle}</p>
                  <p className={styles.rowMeta}>
                    {download.fileName} ·{" "}
                    {formatFileSize(download.fileSizeBytes)} ·{" "}
                    {download.downloadCount}/{download.downloadLimit}{" "}
                    downloads used
                  </p>
                </div>
                <div className={styles.rowSide}>
                  <Button variant="secondary" disabled>
                    Download
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className={styles.note}>
        Fresh, time-limited download links are minted at download time once
        the backend lands — links are never stored or shared.
      </p>
    </div>
  );
}
