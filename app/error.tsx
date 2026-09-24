"use client";

import { Container } from "@/components/layout";
import { Button, EmptyState } from "@/components/ui";
import { routes } from "@/lib/routes";

export interface StorefrontErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function StorefrontError({ reset }: StorefrontErrorProps) {
  return (
    <Container size="narrow">
      <div className="ch-section">
        <EmptyState
          title="Something went wrong on our side"
          description="Give it another moment — your cart and downloads are safe."
          action={
            <span style={{ display: "inline-flex", gap: "0.75rem" }}>
              <Button onClick={reset}>Try again</Button>
              <Button href={routes.home()} variant="secondary">
                Back to home
              </Button>
            </span>
          }
        />
      </div>
    </Container>
  );
}
