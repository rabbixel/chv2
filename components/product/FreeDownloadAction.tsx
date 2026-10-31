"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startFreeCheckout } from "@/app/checkout/free/actions";
import { Icon } from "@/components/ui";
import type { ProductPriceOption } from "@/lib/types";
import styles from "./ProductCard.module.css";

export interface FreeDownloadActionProps {
  slug: string;
  title: string;
  priceOptions?: ProductPriceOption[];
}

export function FreeDownloadAction({ slug, title, priceOptions }: FreeDownloadActionProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const defaultOption = priceOptions?.find((option) => option.isDefault) ?? priceOptions?.[0];
  const priceId = priceOptions?.length ? defaultOption?.id ?? null : null;

  function handleClick() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await startFreeCheckout(slug, priceId);
        if (result.url) router.push(result.url);
        else setError(result.error ?? "Could not start free checkout. Please try again.");
      } catch {
        setError("Could not start free checkout. Please try again.");
      }
    });
  }

  return (
    <span className={styles.freeAction}>
      <button
        type="button"
        className={styles.free}
        aria-label={`Download ${title}`}
        aria-busy={pending}
        title="Download"
        disabled={pending}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleClick();
        }}
      >
        <Icon name="download" size={18} />
      </button>
      {error && <span role="alert" className={styles.freeError}>{error}</span>}
    </span>
  );
}
