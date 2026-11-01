import { ProductGrid } from "@/components/product";
import { routes } from "@/lib/routes";
import type { Product } from "@/lib/types";
import { SectionHeading } from "./SectionHeading";

export interface HattiChoiceProps {
  products: Product[];
  copy?: { eyebrow?: string; heading?: string; description?: string; browse_label?: string; browse_url?: string };
}

export function HattiChoice({ products, copy }: HattiChoiceProps) {
  return (
    <section aria-labelledby="hatti-choice-heading">
      <SectionHeading
        eyebrow={copy?.eyebrow ?? "Handpicked"}
        title={copy?.heading ?? "Creative Hatti's Choice"}
        copy={copy?.description ?? "Creative Hatti's handpicked collection. Discover the perfect creative resource for your next project."}
        actionHref={copy?.browse_url ?? routes.popular()}
        actionLabel={copy?.browse_label ?? "Browse bestsellers"}
      />
      <h2 id="hatti-choice-heading" className="ch-visually-hidden">
        Creative Hatti&apos;s Choice
      </h2>
      <ProductGrid products={products} justified />
    </section>
  );
}
