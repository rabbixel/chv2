import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth";
import { Button } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getAuthService } from "@/lib/services";
import { ResetPasswordForm } from "./ResetPasswordForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Choose a new Creative Hatti password.",
  alternates: { canonical: `${SITE.url}/reset-password` },
  robots: { index: false, follow: false },
};

interface ResetPasswordPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const user = await getAuthService().getCurrentUser();
  if (user) redirect(routes.account());

  const query = (await searchParams) ?? {};
  const error = typeof query.error === "string" ? query.error : null;
  const expired = query.code === "expired-token";

  return (
    <AuthCard
      title="Choose a new password"
      lede="Open the secure link from your reset email to continue."
      error={error}
      footer={
        expired ? (
          <span>Links expire after 24 hours. <Link href={routes.forgotPassword()}>Request a fresh one</Link></span>
        ) : (
          <span>Remembered it after all? <Link href={routes.login()}>Back to log in</Link></span>
        )
      }
    >
      <ResetPasswordForm error={error} />
      <div className={styles.actions}>
        <Button href={routes.forgotPassword()} variant="ghost" fullWidth>Request a fresh link</Button>
      </div>
    </AuthCard>
  );
}
