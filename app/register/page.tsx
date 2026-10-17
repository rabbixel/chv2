import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, RegisterForm } from "@/components/auth";
import { Button } from "@/components/ui";
import { isSafeNextPath } from "@/lib/auth";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getAuthService } from "@/lib/services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Creative Hatti account.",
  alternates: { canonical: `${SITE.url}/register` },
  robots: { index: false, follow: false },
};

interface RegisterPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function param(
  query: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const value = query[name];
  return typeof value === "string" && value ? value : null;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const query = (await searchParams) ?? {};
  const requestedNext = param(query, "next");
  const next = requestedNext && isSafeNextPath(requestedNext)
    ? requestedNext
    : routes.account();

  const user = await getAuthService().getCurrentUser();
  if (user) redirect(next);

  if (param(query, "sent") === "1") {
    return (
      <AuthCard
        title="Check your inbox"
        notice="If an account can be registered with that address, verification instructions are on the way. The link expires in 30 minutes."
        footer={<span>Already verified? <Link href={routes.login(next)}>Log in</Link></span>}
      >
        <Button href={routes.login(next)} fullWidth>Back to log in</Button>
      </AuthCard>
    );
  }

  const error = param(query, "error");
  const errorCode = param(query, "code");
  const fieldError = ["weak-password", "invalid-name", "invalid-email", "password-mismatch"].includes(errorCode ?? "");

  return (
    <AuthCard
      title="Create your account"
      lede="One account for downloads, orders, wishlist and licenses."
      error={fieldError ? null : error}
      footer={
        <span>
          Already have an account?{" "}
          <Link href={routes.login(next)}>Log in</Link>
        </span>
      }
    >
      <RegisterForm
        next={next}
        name={param(query, "name") ?? ""}
        email={param(query, "email") ?? ""}
        initialError={error}
        initialErrorCode={errorCode}
      />
    </AuthCard>
  );
}
