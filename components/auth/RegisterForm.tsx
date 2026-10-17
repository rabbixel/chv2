"use client";

import { useId, useState, type FormEvent } from "react";
import { SubmitButton } from "@/components/checkout";
import { Input } from "@/components/ui";
import { registerAction } from "@/app/account/actions";
import { evaluatePassword, passwordErrorMessage } from "@/lib/auth/passwordPolicy.mjs";
import styles from "@/app/register/page.module.css";
import { PasswordRequirements } from "./PasswordRequirements";

interface RegisterFormProps {
  next: string;
  name: string;
  email: string;
  initialError: string | null;
  initialErrorCode: string | null;
}

export function RegisterForm({ next, name, email, initialError, initialErrorCode }: RegisterFormProps) {
  const requirementsId = useId();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const passwordStatus = evaluatePassword(password);
  const passwordError = password.length > 0 && !passwordStatus.valid
    ? passwordErrorMessage(password) ?? undefined
    : initialErrorCode === "weak-password"
      ? initialError ?? undefined
      : undefined;
  const confirmError = confirmation.length > 0 && confirmation !== password
    ? "Those passwords do not match."
    : initialErrorCode === "password-mismatch"
      ? initialError ?? undefined
      : undefined;

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    setSubmitAttempted(true);
    if (!passwordStatus.valid || password !== confirmation) event.preventDefault();
  }

  return (
    <form action={registerAction} className={styles.form} onSubmit={validateBeforeSubmit}>
      <input type="hidden" name="next" value={next} />
      <div className={styles.fields}>
        <Input label="Full name" name="name" type="text" autoComplete="name" required minLength={2} maxLength={150} defaultValue={name} error={initialErrorCode === "invalid-name" ? initialError ?? undefined : undefined} />
        <Input label="Email" name="email" type="email" autoComplete="email" required defaultValue={email} error={initialErrorCode === "invalid-email" ? initialError ?? undefined : undefined} />
        <div>
          <Input
            label="Password"
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
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.currentTarget.value)}
          error={confirmError ?? (submitAttempted && confirmation !== password ? "Those passwords do not match." : undefined)}
        />
      </div>
      <SubmitButton fullWidth pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
