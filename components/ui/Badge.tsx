import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./Badge.module.css";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "accent"
  | "danger"
  | "info"
  | "success";
export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

export function Badge({
  children,
  variant = "neutral",
  size = "sm",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        styles.badge,
        styles[`variant-${variant}`],
        styles[`size-${size}`],
        className,
      )}
    >
      {children}
    </span>
  );
}
