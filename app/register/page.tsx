import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth";
import { SubmitButton } from "@/components/checkout";
import { Input } from "@/components/ui";
import { isSafeNextPath } from "@/lib/auth";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getAuthService } from "@/lib/services";
import { registerAction } from "../account/actions";
import styles from "./page.module.css";

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

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const query = (await searchParams) ?? {};
  const requestedNext = param(query, "next");
  const next =
    requestedNext && isSafeNextPath(requestedNext)
      ? requestedNext
      : routes.account();

  const user = await getAuthService().getCurrentUser();
  if (user) redirect(next);

  return (
    <AuthCard
      title="Create your account"
      lede="One account for downloads, orders, wishlist and licenses."
      error={param(query, "error")}
      footer={
        <span>
          Already have an account?{" "}
          <Link href={routes.login(next)}>Log in</Link>
        </span>
      }
    >
      <form action={registerAction} className={styles.form}>
        <input type="hidden" name="next" value={next} />
        <div className={styles.fields}>
          <Input
            label="Full name"
            name="name"
            type="text"
            autoComplete="name"
            required
            defaultValue={param(query, "name") ?? ""}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={param(query, "email") ?? ""}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="At least 8 characters."
          />
          <Input
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
        <SubmitButton fullWidth pendingLabel="Creating account…">
          Create account
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
