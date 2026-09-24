import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./Card.module.css";

export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps {
  children: ReactNode;
  padding?: CardPadding;
  /** Adds a hover lift for clickable/teaser cards. */
  interactive?: boolean;
  className?: string;
}

export function Card({
  children,
  padding = "md",
  interactive = false,
  className,
}: CardProps) {
  return (
    <div
      className={cn(
        styles.card,
        styles[`padding-${padding}`],
        interactive && styles.interactive,
        className,
      )}
    >
      {children}
    </div>
  );
}
