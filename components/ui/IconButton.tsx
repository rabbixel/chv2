import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./IconButton.module.css";

export interface IconButtonProps {
  /** Accessible label (also used for the visible caption, if any). */
  label: string;
  children: ReactNode;
  /** When provided, renders a link; otherwise a button. */
  href?: string;
  /** Count pill rendered on the control (cart, wishlist). */
  badge?: number;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  className?: string;
  ariaExpanded?: boolean;
  ariaControls?: string;
}

/** Square ghost control for header icon actions (wishlist, cart, menu…). */
export function IconButton({
  label,
  children,
  href,
  badge,
  onClick,
  className,
  ariaExpanded,
  ariaControls,
}: IconButtonProps) {
  const classes = cn(styles.control, className);
  const content = (
    <>
      <span className={styles.icon} aria-hidden="true">
        {children}
      </span>
      <span className={styles.caption}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <span className="ch-visually-hidden">
        {label}
        {badge !== undefined && badge > 0 ? `, ${badge} items` : ""}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
