import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ContainerProps {
  children: ReactNode;
  size?: "default" | "narrow" | "wide";
  className?: string;
}

export function Container({
  children,
  size = "default",
  className,
}: ContainerProps) {
  return (
    <div
      className={cn(
        "ch-container",
        size === "narrow" && "ch-container--narrow",
        size === "wide" && "ch-container--wide",
        className,
      )}
    >
      {children}
    </div>
  );
}
