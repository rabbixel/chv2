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
  title: "Recover Your Previous Purchases",
  description: "Verify your email to recover eligible Creative Hatti orders and downloads.",
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
        notice="If there are eligible purchases to connect, we’ll send a verification link. Check your inbox and spam folder."
        footer={<Link href={routes.login()}>Back to log in</Link>}
      >
        <p className={styles.note}>
          For your privacy, we do not confirm whether the email is linked to a purchase. Purchases already connected to your account are in Orders and Downloads. A new verification link expires after 30 minutes.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Recover Your Previous Purchases"
      lede="Purchased as a guest or used the previous Creative Hatti website? You can recover eligible orders and downloads here. Enter the email address used for those purchases. We’ll send a one-time verification link to confirm you own that email. Open the link within 30 minutes to connect eligible purchases to your account."
      error={error}
      footer={
        <span>
          Already have an account? <Link href={routes.login()}>Log in</Link>
        </span>
      }
    >
      <form action={requestGuestClaimAction} className={styles.form}>
        <Input
          label="Email used for your purchase"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={100}
          required
        />
        <SubmitButton fullWidth pendingLabel="Sending…">
          Email me a verification link
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
