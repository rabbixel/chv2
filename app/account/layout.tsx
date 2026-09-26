import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccountSidebar } from "@/components/account";
import { Breadcrumbs, Container } from "@/components/layout";
import { requireUser } from "@/lib/auth";
import styles from "./layout.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface AccountLayoutProps {
  children: ReactNode;
}

/**
 * Account shell. `requireUser()` redirects signed-out visitors to login
 * on the server — every `/account/*` page inherits real protection from
 * this layout, not client-side hiding.
 */
export default async function AccountLayout({ children }: AccountLayoutProps) {
  const user = await requireUser();
  const displayName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <Container>
      <div className={styles.shell}>
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Account" }]}
        />
        <p className={styles.greeting}>
          Signed in as <strong>{displayName}</strong> · {user.email}
        </p>
        <div className={styles.grid}>
          <AccountSidebar />
          <div className={styles.main}>{children}</div>
        </div>
      </div>
    </Container>
  );
}
