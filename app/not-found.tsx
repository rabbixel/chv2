import { Container } from "@/components/layout";
import { Button, EmptyState } from "@/components/ui";
import { routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <Container size="narrow">
      <div className="ch-section">
        <EmptyState
          headingLevel="h1"
          title="This page doesn’t exist"
          description="It may have moved, or the link may be incomplete. Head home and keep exploring."
          action={<Button href={routes.home()}>Back to home</Button>}
        />
      </div>
    </Container>
  );
}
