import { Container } from "@/components/layout";
import { Button, EmptyState } from "@/components/ui";
import { routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <Container size="narrow">
      <div className="ch-section">
        <EmptyState
          title="This page doesn’t exist (yet)"
          description="The link may be from a future run of the rebuild. Head home and keep exploring."
          action={<Button href={routes.home()}>Back to home</Button>}
        />
      </div>
    </Container>
  );
}
