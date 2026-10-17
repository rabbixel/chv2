"use client";

import { evaluatePassword, passwordErrorMessage, PASSWORD_CHARACTER_RULES } from "@/lib/auth/passwordPolicy.mjs";
import styles from "./PasswordRequirements.module.css";

export function PasswordRequirements({ password, id }: { password: string; id?: string }) {
  const result = evaluatePassword(password);
  const checks = [
    { key: "minimum", label: "At least 12 characters", valid: result.minimumLengthMet },
    { key: "maximum", label: "No more than 128 characters", valid: result.maximumLengthMet },
    ...PASSWORD_CHARACTER_RULES.map(({ key, label }) => ({
      key,
      label: `At least one ${label}`,
      valid: result.rules[key],
    })),
    {
      key: "three-types",
      label: "Meet at least 3 of the 4 character type rules",
      valid: result.metRuleCount >= result.requiredRuleCount,
    },
  ];

  return (
    <div id={id} className={styles.requirements}>
      <p className={styles.heading}>Password requirements</p>
      <ul aria-label="Password requirements" aria-live="polite" aria-relevant="text" className={styles.list}>
        {checks.map((check) => (
          <li key={check.key} className={check.valid ? styles.met : undefined}>
            {check.label}
          </li>
        ))}
      </ul>
      <p aria-live="polite" className={styles.status}>
        {!password
          ? "Enter a password to check the requirements."
          : result.valid
            ? "Password meets the requirements."
            : passwordErrorMessage(password)}
      </p>
    </div>
  );
}
