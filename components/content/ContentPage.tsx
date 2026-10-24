import type { ReactNode } from "react";
import { Breadcrumbs, Container } from "@/components/layout";
import { routes } from "@/lib/routes";
import styles from "./ContentPage.module.css";

export interface ContentPageProps {
  title: string;
  description: string;
  children: ReactNode;
  policyDraft?: boolean;
}

export function ContentPage({ title, description, children, policyDraft = false }: ContentPageProps) {
  return (
    <Container size="narrow">
      <article className={styles.page}>
        <Breadcrumbs items={[{ label: "Home", href: routes.home() }, { label: title }]} />
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lede}>{description}</p>
        </header>
        {policyDraft && (
          <aside className={styles.draftNotice} aria-label="Policy draft notice">
            <strong>Draft for owner review.</strong> This page is not an approved final policy. Confirm the highlighted business and legal terms before publication.
          </aside>
        )}
        <div className={styles.body}>{children}</div>
      </article>
    </Container>
  );
}
