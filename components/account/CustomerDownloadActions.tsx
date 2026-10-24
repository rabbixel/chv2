import { DownloadButton } from "@/components/account/DownloadButton";
import type { CustomerDownloadItem } from "@/lib/types";
import { getCustomerDownloadPresentation } from "@/lib/services/customerDownloadPresentation.mjs";
import styles from "./CustomerDownloadActions.module.css";

export function CustomerDownloadActions({ item }: { item: CustomerDownloadItem }) {
  const presentation = getCustomerDownloadPresentation(item);
  if (presentation.state !== "available") {
    return <p className={styles.unavailable} role="status">{presentation.message}</p>;
  }

  return (
    <div className={styles.group}>
      <p className={styles.available} role="status">{presentation.message}</p>
      <div className={styles.files}>
        {item.files.map((file) => (
          <div className={styles.file} key={`${item.orderItemId}:${file.key}`}>
            <span className={styles.fileName} title={file.name}>{file.name}</span>
            <DownloadButton
              orderItemId={item.orderItemId}
              fileKey={file.key}
              label={/\.zip$/i.test(file.name) ? "Download ZIP" : "Download file"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
