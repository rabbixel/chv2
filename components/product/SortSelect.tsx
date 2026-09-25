"use client";

import { useRouter } from "next/navigation";
import styles from "./SortSelect.module.css";

export interface SortOption {
  value: string;
  label: string;
}

export interface SortSelectProps {
  id: string;
  value: string;
  options: SortOption[];
  /** Query-string parameter to update (listing pages read it server-side). */
  param?: string;
  label?: string;
}

/**
 * Listing sort control. Updates the URL (`?sort=`) and resets to page 1 so
 * the server re-renders the grid — no client-side data fetching.
 */
export function SortSelect({
  id,
  value,
  options,
  param = "sort",
  label = "Sort by",
}: SortSelectProps) {
  const router = useRouter();

  const onChange = (next: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set(param, next);
    params.delete("page");
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  return (
    <p className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </p>
  );
}
