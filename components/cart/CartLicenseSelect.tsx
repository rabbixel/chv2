"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { updateCart } from "@/app/cart/actions";
import type { LicenseCode } from "@/lib/types";
import type { CartItem } from "@/lib/types";
import styles from "./CartLicenseSelect.module.css";

function UpdateControl() {
  const { pending } = useFormStatus();
  return <>
    <button type="submit" className={styles.update} disabled={pending}>
      {pending ? "Updating…" : "Update"}
    </button>
    <span className="ch-visually-hidden" role="status" aria-live="polite">
      {pending ? "Updating cart price." : ""}
    </span>
  </>;
}

const LICENSE_LABELS: Record<LicenseCode, string> = {
  personal: "Personal",
  commercial: "Commercial",
  extended: "Extended",
};

export interface CartLicenseSelectProps {
  itemKey: string;
  title: string;
  current: LicenseCode;
  options: LicenseCode[];
  priceOptions?: CartItem["priceOptions"];
  currentPriceId?: number | null;
}

/**
 * Per-line license picker. A plain form posting to `updateCart` (works
 * without JavaScript via the Update button); with JavaScript the change
 * submits immediately.
 */
export function CartLicenseSelect({
  itemKey,
  title,
  current,
  options,
  priceOptions,
  currentPriceId,
}: CartLicenseSelectProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateCart} className={styles.form}>
      <input type="hidden" name="key" value={itemKey} />
      {priceOptions?.length ? <>
        <label className={styles.label}>
          <span className="ch-visually-hidden">Price option for {title}</span>
          <select name="price_id" defaultValue={currentPriceId ?? ""} onChange={() => formRef.current?.requestSubmit()} className={styles.select}>
            {priceOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        <input type="hidden" name="license" value="personal" />
      </> : <>
      <label className={styles.label}>
        <span className="ch-visually-hidden">Licence for {title}</span>
        <select
          name="license"
          defaultValue={current}
          onChange={() => formRef.current?.requestSubmit()}
          className={styles.select}
        >
          {options.map((code) => (
            <option key={code} value={code}>
              {LICENSE_LABELS[code]} licence
            </option>
          ))}
        </select>
      </label>
      </>}
      <UpdateControl />
    </form>
  );
}
