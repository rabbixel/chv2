"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import type { ButtonSize, ButtonVariant } from "@/components/ui";

export interface SubmitButtonProps {
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/** Form submit with an automatic pending state (processing feedback). */
export function SubmitButton({
  children,
  pendingLabel,
  variant,
  size,
  fullWidth,
  className,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      className={className}
      loading={pending}
      disabled={pending}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
