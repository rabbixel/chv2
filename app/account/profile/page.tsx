import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getSessionUser } from "@/lib/auth";
import { ApiError } from "@/lib/api/client";
import { EmptyState, Input } from "@/components/ui";
import { SubmitButton } from "@/components/checkout";
import { getCustomerProfileService, isWordPressAuthEnabled } from "@/lib/services";
import { formatDate } from "@/lib/utils";
import { updateProfileAction } from "../actions";
import styles from "../section.module.css";
import formStyles from "../settings/page.module.css";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your Creative Hatti profile.",
  alternates: { canonical: `${SITE.url}/account/profile` },
};

interface AccountProfilePageProps {
  searchParams?: Promise<{ saved?: string; error?: string | string[] }>;
}

export const dynamic = "force-dynamic";

export default async function AccountProfilePage({ searchParams }: AccountProfilePageProps) {
  const query = (await searchParams) ?? {};
  const saved = query.saved === "1";
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  if (isWordPressAuthEnabled()) {
    let profile;
    try {
      profile = await getCustomerProfileService().get();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirect(routes.login(routes.accountProfile()));
      }
      return (
        <div>
          <h1 className={styles.title}>Profile</h1>
          <EmptyState title="Profile could not be loaded" description="Please refresh the page or try again shortly." />
        </div>
      );
    }
    return (
      <div>
        <h1 className={styles.title}>Profile</h1>
        <p className={styles.lede}>How your account identifies you.</p>
        {saved && <p role="status" className={styles.notice}>Profile saved.</p>}
        {error && <p role="alert" className={styles.alert}>{error}</p>}
        <Card>
          <form action={updateProfileAction} className={formStyles.form}>
            <div className={formStyles.fields}>
              <Input label="First name" name="firstName" type="text" autoComplete="given-name" required maxLength={200} defaultValue={profile.firstName} />
              <Input label="Last name" name="lastName" type="text" autoComplete="family-name" maxLength={200} defaultValue={profile.lastName} />
            </div>
            <div><SubmitButton pendingLabel="Saving…">Save profile</SubmitButton></div>
          </form>
          <dl className={styles.defs}>
            <dt>Email</dt><dd>{profile.email}</dd>
            <dt>Member since</dt><dd>{formatDate(profile.createdAt)}</dd>
          </dl>
        </Card>
        <p className={styles.note}>Changing your email requires a separate verification flow.</p>
      </div>
    );
  }

  const user = await getSessionUser();
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ")
    : "";

  return (
    <div>
      <h1 className={styles.title}>Profile</h1>
      <p className={styles.lede}>How your account identifies you.</p>
      {saved && <p role="status" className={styles.notice}>Profile saved.</p>}
      {error && <p role="alert" className={styles.alert}>{error}</p>}
      <Card>
        <form action={updateProfileAction} className={formStyles.form}>
          <input type="hidden" name="returnTo" value="profile" />
          <div className={formStyles.fields}>
            <Input label="First name" name="firstName" type="text" autoComplete="given-name" required maxLength={200} defaultValue={user?.firstName ?? ""} />
            <Input label="Last name" name="lastName" type="text" autoComplete="family-name" maxLength={200} defaultValue={user?.lastName ?? ""} />
          </div>
          <div><SubmitButton pendingLabel="Saving…">Save profile</SubmitButton></div>
        </form>
        <dl className={styles.defs}>
          <dt>Name</dt>
          <dd>{displayName || "—"}</dd>
          <dt>Email</dt>
          <dd>{user?.email ?? "—"}</dd>
          <dt>Member since</dt>
          <dd>{user ? formatDate(user.createdAt) : "—"}</dd>
        </dl>
      </Card>
      <p className={styles.note}>
        Changing your email requires a separate verification flow.
      </p>
    </div>
  );
}
