import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth";
import { getAuthService } from "@/lib/services";
import { routes } from "@/lib/routes";
import { ClaimVerificationForm } from "./verification-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify your purchase email",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface VerifyPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ClaimVerificationPage({ searchParams }: VerifyPageProps) {
  const query = (await searchParams) ?? {};
  const error = typeof query.error === "string" ? query.error : null;
  const user = await getAuthService().getCurrentUser();
  const pendingClaim = await getAuthService().hasPendingGuestClaim();

  return (
    <AuthCard
      title="Verify your purchase email"
      lede={
        user
          ? "Continue to securely link the verified purchase record to your signed-in account."
          : "Verify your email to create an account and connect your previous purchase."
      }
      error={error}
      footer={
        <span>
          Need a fresh link? <Link href={routes.claimAccount()}>Request another</Link>
        </span>
      }
    >
      <ClaimVerificationForm signedIn={!!user} pendingClaim={pendingClaim} />
    </AuthCard>
  );
}
