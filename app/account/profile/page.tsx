import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getSessionUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import styles from "../section.module.css";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your Creative Hatti profile.",
  alternates: { canonical: `${SITE.url}/account/profile` },
};

export default async function AccountProfilePage() {
  const user = await getSessionUser();
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ")
    : "";

  return (
    <div>
      <h1 className={styles.title}>Profile</h1>
      <p className={styles.lede}>How your account identifies you.</p>
      <Card>
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
        Profile editing arrives with the backend. To change your password,{" "}
        <Link href={routes.forgotPassword()}>request a reset link</Link>.
      </p>
    </div>
  );
}
