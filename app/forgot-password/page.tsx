import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth";
import { SubmitButton } from "@/components/checkout";
import { Button, Input } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getAuthService } from "@/lib/services";
import { forgotPasswordAction } from "../account/actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Reset your Creative Hatti password.",
  alternates: { canonical: `${SITE.url}/forgot-password` },
  robots: { index: false, follow: false },
};

interface ForgotPasswordPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const user = await getAuthService().getCurrentUser();
  if (user) redirect(routes.account());

  const query = (await searchParams) ?? {};
  const sent = query.sent === "1";
  const error = typeof query.error === "string" ? query.error : null;

  if (sent) {
    return (
      <AuthCard
        title="Check your inbox"
        notice="If an account exists with that email, a reset link is on its way. The link expires in 24 hours."
        footer={
          <span>
            Remembered it after all?{" "}
            <Link href={routes.login()}>Back to log in</Link>
          </span>
        }
      >
        <div className={styles.actions}>
          <Button href={routes.login()} variant="ghost" fullWidth>
            Back to log in
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot password?"
      lede="Enter your account email and we will send you a reset link. Classic-store customers: this is also how you activate your new account."
      error={error}
      footer={
        <span>
          Remembered it after all?{" "}
          <Link href={routes.login()}>Back to log in</Link>
        </span>
      }
    >
      <form action={forgotPasswordAction} className={styles.form}>
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <SubmitButton fullWidth pendingLabel="Sending…">
          Send reset link
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
