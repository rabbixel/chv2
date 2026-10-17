import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccountSidebar } from "@/components/account";
import { Breadcrumbs, Container } from "@/components/layout";
import { Button } from "@/components/ui";
import { AuthServiceUnavailableError } from "@/lib/auth/availability.mjs";
import { requireUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import type { AuthUser } from "@/lib/types";
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
  let user: AuthUser;
  try {
    user = await requireUser();
  } catch (error) {
    if (!(error instanceof AuthServiceUnavailableError)) throw error;
    return (
      <Container>
        <div className={styles.unavailable} role="alert">
          <h1>Account temporarily unavailable</h1>
          <p>We can’t confirm your account right now. Your session and account data are unchanged. Please try again shortly.</p>
          <Button href={routes.account()}>Try again</Button>
        </div>
      </Container>
    );
  }
  const displayName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <Container>
      <div className={styles.shell}>
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Account" }]}
        />
        <p className={`${styles.greeting} ${styles.printHide}`}>
          Signed in as <strong>{displayName}</strong> · {user.email}
        </p>
        <div className={styles.grid}>
          <div className={styles.printHide}>
            <AccountSidebar />
          </div>
          <div className={styles.main}>{children}</div>
        </div>
      </div>
    </Container>
  );
}
