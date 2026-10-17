"use client";

import { useEffect, useSyncExternalStore } from "react";
import { SubmitButton } from "@/components/checkout";
import { Input } from "@/components/ui";
import { resendActivationAction, verifyEmailAction } from "@/app/account/actions";
import styles from "./verification-form.module.css";

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function getToken() {
  const token = window.location.hash.slice(1);
  return /^[a-f0-9]{64}$/.test(token) ? token : "";
}

function getServerToken() {
  return "";
}

export function VerificationForm() {
  const token = useSyncExternalStore(subscribe, getToken, getServerToken);

  useEffect(() => {
    if (token) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [token]);

  return token ? (
    <form action={verifyEmailAction} className={styles.form}>
      <input type="hidden" name="token" value={token} />
      <p className={styles.note}>This secure link can be used once.</p>
      <SubmitButton fullWidth pendingLabel="Verifying…">Verify email and continue</SubmitButton>
    </form>
  ) : (
    <div className={styles.form}>
      <p className={styles.note}>Open the secure link from your email. If it expired or did not arrive, request another below.</p>
      <form action={resendActivationAction} className={styles.form}>
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <SubmitButton fullWidth pendingLabel="Sending…">Send verification link</SubmitButton>
      </form>
    </div>
  );
}
