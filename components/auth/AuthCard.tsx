import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import styles from "./AuthCard.module.css";

export interface AuthCardProps {
  title: string;
  lede?: string;
  error?: string | null;
  notice?: string | null;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared shell for the auth pages: narrow centered card with a consistent
 * error/notice banner vocabulary. Banners render server-side from the
 * `?error=` / `?notice=` query the actions redirect back with.
 */
export function AuthCard({
  title,
  lede,
  error,
  notice,
  children,
  footer,
}: AuthCardProps) {
  return (
    <Container size="narrow">
      <div className={styles.page}>
        <Card padding="lg" className={styles.card}>
          <h1 className={styles.title}>{title}</h1>
          {lede && <p className={styles.lede}>{lede}</p>}
          {error && (
            <p role="alert" className={cn(styles.banner, styles.error)}>
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className={cn(styles.banner, styles.notice)}>
              {notice}
            </p>
          )}
          {children}
          {footer && <div className={styles.footer}>{footer}</div>}
        </Card>
      </div>
    </Container>
  );
}
