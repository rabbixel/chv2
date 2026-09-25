import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/checkout";
import { Card, Input } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getSessionUser } from "@/lib/auth";
import { getCustomerService } from "@/lib/services";
import {
  logoutAction,
  updatePreferencesAction,
  updateProfileAction,
} from "../actions";
import styles from "../section.module.css";
import formStyles from "./page.module.css";

export const metadata: Metadata = {
  title: "Settings",
  description: "Your Creative Hatti account settings.",
  alternates: { canonical: `${SITE.url}/account/settings` },
};

interface SettingsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountSettingsPage({
  searchParams,
}: SettingsPageProps) {
  const [user, preferences] = await Promise.all([
    getSessionUser(),
    getCustomerService().getNotificationPreferences(),
  ]);
  const query = (await searchParams) ?? {};
  const saved = typeof query.saved === "string" ? query.saved : null;
  const error = typeof query.error === "string" ? query.error : null;

  return (
    <div>
      <h1 className={styles.title}>Settings</h1>
      <p className={styles.lede}>Your session and account preferences.</p>
      {saved === "profile" && (
        <p role="status" className={styles.notice}>
          Profile saved.
        </p>
      )}
      {saved === "notifications" && (
        <p role="status" className={styles.notice}>
          Notification preferences saved.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      )}
      <div className={styles.list}>
        <Card>
          <h2 className={styles.splitTitle}>Profile</h2>
          <form action={updateProfileAction} className={formStyles.form}>
            <div className={formStyles.fields}>
              <Input
                label="First name"
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
                defaultValue={user?.firstName ?? ""}
              />
              <Input
                label="Last name"
                name="lastName"
                type="text"
                autoComplete="family-name"
                defaultValue={user?.lastName ?? ""}
              />
            </div>
            <div>
              <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
            </div>
          </form>
        </Card>
        <Card>
          <h2 className={styles.splitTitle}>Email</h2>
          <p className={styles.rowMeta}>{user?.email ?? "—"}</p>
          <p className={styles.note}>
            Email changes need verification — please{" "}
            <Link href={routes.contact()}>contact support</Link> and
            we&apos;ll help.
          </p>
        </Card>
        <Card>
          <div className={styles.row}>
            <div className={styles.rowMain}>
              <h2 className={styles.splitTitle}>Password</h2>
              <p className={styles.rowMeta}>
                Change it anytime with a secure reset link.
              </p>
            </div>
            <div className={styles.rowSide}>
              <Link href={routes.forgotPassword()}>Change password</Link>
            </div>
          </div>
        </Card>
        <Card>
          <h2 className={styles.splitTitle}>Notifications</h2>
          <form action={updatePreferencesAction} className={formStyles.form}>
            <label className={formStyles.check}>
              <input
                type="checkbox"
                name="orderUpdates"
                value="on"
                defaultChecked={preferences.orderUpdates}
                className={formStyles.checkbox}
              />
              Order updates (payment, downloads ready)
            </label>
            <label className={formStyles.check}>
              <input
                type="checkbox"
                name="newProducts"
                value="on"
                defaultChecked={preferences.newProducts}
                className={formStyles.checkbox}
              />
              New Indian vectors, bundles and collections
            </label>
            <label className={formStyles.check}>
              <input
                type="checkbox"
                name="offers"
                value="on"
                defaultChecked={preferences.offers}
                className={formStyles.checkbox}
              />
              Festive offers and discounts
            </label>
            <div>
              <SubmitButton pendingLabel="Saving…">
                Save preferences
              </SubmitButton>
            </div>
          </form>
        </Card>
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
      </div>
    </div>
  );
}
