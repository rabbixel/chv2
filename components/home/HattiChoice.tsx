import { ProductGrid } from "@/components/product";
import { routes } from "@/lib/routes";
import type { Product } from "@/lib/types";
import { SectionHeading } from "./SectionHeading";

export interface HattiChoiceProps {
  products: Product[];
}

export function HattiChoice({ products }: HattiChoiceProps) {
  return (
    <section aria-labelledby="hatti-choice-heading">
      <SectionHeading
        eyebrow="Handpicked"
        title="Creative Hatti's Choice"
        copy="Creative Hatti's handpicked collection. Discover the perfect creative resource for your next project."
        actionHref={routes.popular()}
        actionLabel="Browse bestsellers"
      />
      <h2 id="hatti-choice-heading" className="ch-visually-hidden">
        Creative Hatti&apos;s Choice
      </h2>
      <ProductGrid products={products} />
    </section>
  );
}
