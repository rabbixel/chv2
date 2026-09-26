"use client";

import { useRef } from "react";
import { updateCart } from "@/app/cart/actions";
import type { LicenseCode } from "@/lib/types";
import styles from "./CartLicenseSelect.module.css";

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
}: CartLicenseSelectProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateCart} className={styles.form}>
      <input type="hidden" name="key" value={itemKey} />
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
      <button type="submit" className={styles.update}>
        Update
      </button>
    </form>
  );
}
