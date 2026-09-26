import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { routes } from "@/lib/routes";
import type { CartItem, LicenseCode } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import styles from "./CartItemRow.module.css";

const LICENSE_LABELS: Record<LicenseCode, string> = {
  personal: "Personal",
  commercial: "Commercial",
  extended: "Extended",
};

export interface CartItemRowProps {
  item: CartItem;
  /** Optional client-side removal handler (cart drawer wires this up). */
  onRemove?: (key: string) => void;
  /** License picker (cart page). Renders in place of the license badge. */
  licenseControl?: ReactNode;
  /** Line actions (remove form, wishlist). Replaces the remove button. */
  actions?: ReactNode;
}

export function CartItemRow({
  item,
  onRemove,
  licenseControl,
  actions,
}: CartItemRowProps) {
  return (
    <li className={styles.row}>
      <span className={styles.thumb} aria-hidden="true">
        {item.title.charAt(0)}
      </span>
      <div className={styles.details}>
        <Link href={routes.product(item.productSlug)} className={styles.title}>
          {item.title}
        </Link>
        <p className={styles.meta}>
          {licenseControl ?? (
            <Badge variant="neutral" size="sm">
              {LICENSE_LABELS[item.license]} licence
            </Badge>
          )}
          <span className={styles.unit}>{formatMoney(item.unitPrice)}</span>
        </p>
      </div>
      <p className={styles.total}>{formatMoney(item.lineTotal)}</p>
      {actions ??
        (onRemove && (
          <button
            type="button"
            className={styles.remove}
            onClick={() => onRemove(item.key)}
            aria-label={`Remove ${item.title} from cart`}
          >
            Remove
          </button>
        ))}
    </li>
  );
}
