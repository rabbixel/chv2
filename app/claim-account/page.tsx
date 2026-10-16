import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth";
import { SubmitButton } from "@/components/checkout";
import { Input } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { isWordPressAuthEnabled } from "@/lib/services";
import { requestGuestClaimAction } from "../account/actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Access a classic-store purchase",
  description: "Verify your email to access historical Creative Hatti purchases.",
  alternates: { canonical: `${SITE.url}/claim-account` },
  robots: { index: false, follow: false },
};

interface ClaimPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ClaimAccountPage({ searchParams }: ClaimPageProps) {
  const query = (await searchParams) ?? {};
  const sent = query.sent === "1";
  const error = typeof query.error === "string" ? query.error : null;
  const wordpressAuth = isWordPressAuthEnabled();

  if (!wordpressAuth) {
    return (
      <AuthCard
        title="Account claiming is unavailable"
        lede="Please try again later or sign in to your account."
        footer={<Link href={routes.login()}>Back to log in</Link>}
      >
        <div className={styles.actions}>
          <Link className={styles.button} href={routes.login()}>
            Back to log in
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (sent) {
    return (
      <AuthCard
        title="Check your inbox"
        notice="If we can verify an eligible purchase record for that email, a link is on its way. Check your inbox and spam folder."
        footer={<Link href={routes.login()}>Back to log in</Link>}
      >
        <p className={styles.note}>
          For your privacy, this page does not confirm whether an account or purchase history exists.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Access a classic-store purchase"
      lede="Enter the email address used for your older Creative Hatti purchases. We will send a verification link if an eligible purchase record is found."
      error={error}
      footer={
        <span>
          Already have an account? <Link href={routes.login()}>Log in</Link>
        </span>
      }
    >
      <form action={requestGuestClaimAction} className={styles.form}>
        <Input
          label="Purchase email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={100}
          required
        />
        <SubmitButton fullWidth pendingLabel="Sending…">
          Send verification link
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
