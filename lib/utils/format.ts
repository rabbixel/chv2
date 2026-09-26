import { SITE } from "@/lib/constants";
import type { ISODateString, Money } from "@/lib/types";

const moneyFormatters = new Map<string, Intl.NumberFormat>();
const compactFormatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string): Intl.NumberFormat {
  const key = `${SITE.locale}:${currency}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(SITE.locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    moneyFormatters.set(key, formatter);
  }
  return formatter;
}

/** Render minor-unit Money, e.g. `{ amount: 49900, currency: "INR" }` → `₹499`. */
export function formatMoney(money: Money): string {
  return moneyFormatter(money.currency).format(money.amount / 100);
}

/** Whole-number discount percent between compare-at and sale price. */
export function discountPercent(
  compareAt: Money | undefined,
  price: Money,
): number | null {
  if (!compareAt || compareAt.amount <= price.amount) return null;
  return Math.round((1 - price.amount / compareAt.amount) * 100);
}

export function formatDate(value: ISODateString | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(SITE.locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Compact counts for ratings/sales, e.g. `12.4k`. */
export function formatCompact(value: number): string {
  const key = SITE.locale;
  let formatter = compactFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(SITE.locale, { notation: "compact" });
    compactFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const size = bytes / 1024 ** index;
  return `${size >= 100 ? Math.round(size) : size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
