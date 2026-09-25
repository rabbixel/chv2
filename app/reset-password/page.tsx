import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth";
import { SubmitButton } from "@/components/checkout";
import { Button, Input } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getAuthService } from "@/lib/services";
import { resetPasswordAction } from "../account/actions";
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

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const user = await getAuthService().getCurrentUser();
  if (user) redirect(routes.account());

  const query = (await searchParams) ?? {};
  const token = typeof query.token === "string" ? query.token : "";
  const error = typeof query.error === "string" ? query.error : null;
  const expired = query.code === "expired-token";

  if (!token) {
    return (
      <AuthCard
        title="Reset link missing"
        lede="This page needs the secure link from your reset email."
        error="Open the reset link from your email, or request a fresh one below."
        footer={
          <span>
            Remembered it after all?{" "}
            <Link href={routes.login()}>Back to log in</Link>
          </span>
        }
      >
        <div className={styles.actions}>
          <Button href={routes.forgotPassword()} fullWidth>
            Request a new link
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      error={error}
      footer={
        expired ? (
          <span>
            Links expire after 24 hours.{" "}
            <Link href={routes.forgotPassword()}>Request a fresh one</Link>
          </span>
        ) : (
          <span>
            Remembered it after all?{" "}
            <Link href={routes.login()}>Back to log in</Link>
          </span>
        )
      }
    >
      <form action={resetPasswordAction} className={styles.form}>
        <input type="hidden" name="token" value={token} />
        <div className={styles.fields}>
          <Input
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="At least 8 characters."
          />
          <Input
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
        <SubmitButton fullWidth pendingLabel="Updating…">
          Update password
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
