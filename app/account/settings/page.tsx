import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/checkout";
import { Card } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getSessionUser } from "@/lib/auth";
import { logoutAction } from "../actions";
import styles from "../section.module.css";

export const metadata: Metadata = {
  title: "Settings",
  description: "Your Creative Hatti account settings.",
  alternates: { canonical: `${SITE.url}/account/settings` },
};

export default async function AccountSettingsPage() {
  const user = await getSessionUser();

  return (
    <div>
      <h1 className={styles.title}>Settings</h1>
      <p className={styles.lede}>Your session and account preferences.</p>
      <div className={styles.list}>
        <Card>
          <div className={styles.row}>
            <div className={styles.rowMain}>
              <p className={styles.rowTitle}>Signed in as</p>
              <p className={styles.rowMeta}>{user?.email ?? "—"}</p>
            </div>
            <div className={styles.rowSide}>
              <form action={logoutAction}>
                <SubmitButton variant="ghost" pendingLabel="Logging out…">
                  Log out
                </SubmitButton>
              </form>
            </div>
          </div>
        </Card>
        <Card>
          <div className={styles.row}>
            <div className={styles.rowMain}>
              <p className={styles.rowTitle}>Password</p>
              <p className={styles.rowMeta}>
                Change it anytime with a secure reset link.
              </p>
            </div>
            <div className={styles.rowSide}>
              <Link href={routes.forgotPassword()}>Change password</Link>
            </div>
          </div>
        </Card>
      </div>
      <p className={styles.note}>
        Email preferences and connected devices arrive with the backend.
      </p>
    </div>
  );
}
