import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import styles from "./Input.module.css";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  /** Visually hide the label (kept for screen readers). */
  hideLabel?: boolean;
  hint?: string;
  error?: string;
}

export function Input({
  label,
  hideLabel = false,
  hint,
  error,
  className,
  ...inputProps
}: InputProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn(styles.field, className)}>
      <label
        htmlFor={id}
        className={cn(styles.label, hideLabel && "ch-visually-hidden")}
      >
        {label}
      </label>
      <input
        id={id}
        className={cn(styles.input, error && styles.hasError)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        {...inputProps}
      />
      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
