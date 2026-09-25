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
import { loginAction, resendActivationAction } from "../account/actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Creative Hatti account.",
  alternates: { canonical: `${SITE.url}/login` },
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function param(
  query: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const value = query[name];
  return typeof value === "string" && value ? value : null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = (await searchParams) ?? {};
  const requestedNext = param(query, "next");
  const next =
    requestedNext && isSafeNextPath(requestedNext)
      ? requestedNext
      : routes.account();

  const user = await getAuthService().getCurrentUser();
  if (user) redirect(next);

  const error = param(query, "error");
  const code = param(query, "code");
  const email = param(query, "email") ?? "";
  const notice =
    param(query, "notice") ??
    (param(query, "reset") === "success"
      ? "Password updated — please log in with your new password."
      : null) ??
    (requestedNext && requestedNext !== routes.account()
      ? "Please log in to continue to that page."
      : null);

  return (
    <AuthCard
      title="Welcome back"
      lede="Log in to your downloads, orders and wishlist."
      error={error}
      notice={notice}
      footer={
        <>
          <span>
            New to Creative Hatti?{" "}
            <Link href={routes.register(next)}>Create an account</Link>
          </span>
          <span>
            From our classic store?{" "}
            <Link href={routes.forgotPassword()}>
              Reset your password to activate your account
            </Link>
          </span>
        </>
      }
    >
      <form action={loginAction} className={styles.form}>
        <input type="hidden" name="next" value={next} />
        <div className={styles.fields}>
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={email}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className={styles.row}>
          <label className={styles.remember}>
            <input
              type="checkbox"
              name="remember"
              value="on"
              className={styles.checkbox}
            />
            Keep me logged in
          </label>
          <Link href={routes.forgotPassword()} className={styles.forgot}>
            Forgot password?
          </Link>
        </div>
        <SubmitButton fullWidth pendingLabel="Logging in…">
          Log in
        </SubmitButton>
      </form>
      {code === "not-activated" && (
        <form action={resendActivationAction} className={styles.resend}>
          <input type="hidden" name="email" value={email} />
          <p className={styles.resendText}>
            Didn&apos;t get the activation email?
          </p>
          <SubmitButton variant="ghost" pendingLabel="Sending…">
            Re-send activation email
          </SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}
