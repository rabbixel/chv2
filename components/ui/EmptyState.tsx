import type { ReactNode } from "react";
import { Card } from "./Card";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Primary action, e.g. a "Browse products" button. */
  action?: ReactNode;
  /**
   * Title element. Standalone pages (404, error, empty cart/checkout)
   * pass "h1" so the page keeps exactly one top-level heading; embedded
   * states keep the default "p".
   */
  headingLevel?: "h1" | "h2" | "p";
}

export function EmptyState({
  title,
  description,
  action,
  headingLevel = "p",
}: EmptyStateProps) {
  const Title = headingLevel;
  return (
    <Card padding="lg" className={styles.empty}>
      <Title className={styles.title}>{title}</Title>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </Card>
  );
}
