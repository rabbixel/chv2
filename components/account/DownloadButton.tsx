"use client";

import { useState } from "react";
import { requestCustomerDownloadAction, requestDownloadAction } from "@/app/account/actions";
import { Button } from "@/components/ui";
import type { ID } from "@/lib/types";
import styles from "./DownloadButton.module.css";

export interface DownloadButtonProps {
  productId?: ID;
  orderId?: ID;
  orderItemId?: ID;
  fileKey?: string;
  label?: string;
}

/**
 * Per-file download trigger. Requests a short-lived URL from the server
 * on every click (S3-signed in production) and navigates to it — the
 * browser never sees bucket credentials or a reusable link.
 */
export function DownloadButton({
  productId,
  orderId,
  orderItemId,
  fileKey,
  label = "Download",
}: DownloadButtonProps) {
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (preparing) return;
    setPreparing(true);
    setError(null);
    try {
      const result = orderItemId && fileKey
        ? await requestCustomerDownloadAction(String(orderItemId), fileKey)
        : productId && orderId
          ? await requestDownloadAction(productId, orderId)
          : { error: "This download is unavailable." };
      if ("url" in result) {
        window.location.href = result.url;
      } else {
        setError(result.error);
      }
    } catch {
      setError("Could not prepare your download. Please try again.");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <span className={styles.wrap}>
      <Button
        variant="secondary"
        onClick={handleClick}
        loading={preparing}
        disabled={preparing}
      >
        {label}
      </Button>
      {error && (
        <span role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </span>
  );
}
