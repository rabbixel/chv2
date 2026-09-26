import { cn } from "@/lib/utils";
import styles from "./Spinner.module.css";

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps {
  size?: SpinnerSize;
  /** Accessible label. Pass "" to hide (when adjacent text describes state). */
  label?: string;
  className?: string;
}

export function Spinner({
  size = "md",
  label = "Loading",
  className,
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(styles.spinner, styles[`size-${size}`], className)}
    >
      {label ? <span className="ch-visually-hidden">{label}</span> : null}
    </span>
  );
}
