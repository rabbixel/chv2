"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { SubmitButton } from "@/components/checkout";
import { Input } from "@/components/ui";
import { evaluatePassword, passwordErrorMessage } from "@/lib/auth/passwordPolicy.mjs";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";
import { resetPasswordAction } from "@/app/account/actions";
import styles from "./page.module.css";

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

export function ResetPasswordForm({ error }: { error: string | null }) {
  const requirementsId = useId();
  const token = useSyncExternalStore(subscribe, getToken, getServerToken);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const passwordStatus = evaluatePassword(password);
  const passwordError = password.length > 0 && !passwordStatus.valid
    ? passwordErrorMessage(password) ?? undefined
    : undefined;

  useEffect(() => {
    if (token) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [token]);

  if (!token) {
    return <p className={styles.note}>{error ?? "Open the secure link from your reset email, or request a fresh one below."}</p>;
  }

  return (
    <form
      action={resetPasswordAction}
      className={styles.form}
      onSubmit={(event) => {
        setSubmitAttempted(true);
        if (!passwordStatus.valid || password !== confirmation) {
          event.preventDefault();
          setConfirmationError(password !== confirmation ? "Those passwords do not match." : null);
        } else {
          setConfirmationError(null);
        }
      }}
    >
      <input type="hidden" name="token" value={token} />
      <div className={styles.fields}>
        <div>
          <Input
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            error={passwordError}
            aria-describedby={requirementsId}
          />
          <PasswordRequirements password={password} id={requirementsId} />
        </div>
        <Input
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.currentTarget.value)}
          error={confirmationError ?? (submitAttempted && password !== confirmation ? "Those passwords do not match." : undefined)}
        />
      </div>
      <SubmitButton fullWidth pendingLabel="Updating…">Update password</SubmitButton>
    </form>
  );
}
