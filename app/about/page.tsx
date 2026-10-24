import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "About Creative Hatti",
  description: "Learn about Creative Hatti, a marketplace for digital graphics and design resources.",
  alternates: { canonical: `${SITE.url}${routes.about()}` },
};

export default function AboutPage() {
  return (
    <ContentPage title="About Creative Hatti" description="A place to find digital artwork and resources for creative projects.">
      <section>
        <h2>Creative resources with an Indian perspective</h2>
        <p>Creative Hatti is a marketplace for digital graphics, vectors, illustrations, fonts, templates, character bundles, and other design resources. The earlier Creative Hatti story describes its work as shaped by the creativity and culture of India; that perspective continues to inform the catalogue.</p>
        <p>Browse by <Link href={routes.categories()}>category</Link>, explore <Link href={routes.collections()}>collections</Link>, or search for a specific kind of asset.</p>
      </section>
      <section>
        <h2>Choose the right resource for your project</h2>
        <p>Product pages describe the available files, price options, and applicable license information. Please review those details before purchasing or using a file. The product license, not a sales limit or purchase alone, is the place to confirm any usage or ownership rights that are specifically offered.</p>
        <p>Questions about a design or its permitted use? <Link href={routes.contact()}>Contact the team</Link> before relying on an interpretation that is not stated on the product page.</p>
      </section>
      <section>
        <h2>Explore</h2>
        <p>Start with <Link href={routes.popular()}>popular designs</Link>, see <Link href={routes.newArrivals()}>new arrivals</Link>, or browse <Link href={routes.freeDownloads()}>free downloads</Link>.</p>
      </section>
    </ContentPage>
  );
}
