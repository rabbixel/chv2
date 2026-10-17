import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { VerificationForm } from "./verification-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Verify your Creative Hatti account email.",
  alternates: { canonical: `${SITE.url}/verify-email` },
  robots: { index: false, follow: false },
};

interface VerifyEmailPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const query = (await searchParams) ?? {};
  const error = typeof query.error === "string" ? query.error : null;
  const resent = query.resent === "1";
  const verified = query.verified === "1";
  const loginRequired = query.login === "required";

  return (
    <AuthCard
      title="Verify your email"
      lede="Open the verification link sent to your email address."
      error={error}
      notice={loginRequired
        ? "Your email is verified. Log out and sign in with the account for this email to continue."
        : resent
          ? "If the account is waiting for verification, a fresh link is on the way."
          : verified
            ? "Your email is verified. You can now sign in."
            : null}
      footer={<span>Already verified? <Link href={routes.login()}>Log in</Link></span>}
    >
      <VerificationForm />
    </AuthCard>
  );
}
