"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/checkout";
import { Input } from "@/components/ui";
import { routes } from "@/lib/routes";
import {
  completeGuestClaimAction,
  signOutForGuestClaimAction,
} from "../../account/actions";
import styles from "./verification-form.module.css";

interface ClaimVerificationFormProps {
  signedIn: boolean;
  pendingClaim: boolean;
}

function subscribeToClaimToken() {
  return () => {};
}

function getClaimTokenFromFragment() {
  const value = window.location.hash.slice(1);
  return /^[a-f0-9]{64}$/.test(value) ? value : "";
}

function getServerClaimToken() {
  return "";
}

export function ClaimVerificationForm({
  signedIn,
  pendingClaim,
}: ClaimVerificationFormProps) {
  const token = useSyncExternalStore(
    subscribeToClaimToken,
    getClaimTokenFromFragment,
    getServerClaimToken,
  );

  useEffect(() => {
    if (token) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [token]);

  if (pendingClaim && !signedIn) {
    return (
      <div className={styles.form}>
        <p className={styles.note}>Your verified link is ready. Sign in to the WordPress account that uses that email to continue.</p>
        <Link className={styles.link} href={routes.login(routes.claimVerify())}>
          Sign in to continue
        </Link>
      </div>
    );
  }

  if (!pendingClaim && !token) {
    return <p className={styles.note}>Open the verification link from your email, or request a fresh link.</p>;
  }

  return (
    <>
      <form action={completeGuestClaimAction} className={styles.form}>
        {!pendingClaim && <input type="hidden" name="token" value={token} />}
        {!signedIn && (
          <>
            <p className={styles.note}>Choose a password for your new Creative Hatti account.</p>
            <Input label="First name" name="firstName" autoComplete="given-name" required />
            <Input label="Last name" name="lastName" autoComplete="family-name" />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              hint="Use at least 12 characters."
            />
          </>
        )}
        <SubmitButton fullWidth pendingLabel="Verifying…">
          {signedIn ? "Verify and link purchase" : "Create account and link purchase"}
        </SubmitButton>
      </form>
      {signedIn && (
        <form action={signOutForGuestClaimAction} className={styles.signOut}>
          <p className={styles.note}>If you are signed in to a different account, sign out and use the account for the verified email.</p>
          <SubmitButton variant="ghost" pendingLabel="Signing out…">
            Sign out and choose another account
          </SubmitButton>
        </form>
      )}
    </>
  );
}
