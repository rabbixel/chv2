import type { Metadata } from "next";
import { ContentPage } from "@/components/content";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: "Terms for purchasing and using Creative Hatti digital creative assets.",
  alternates: { canonical: `${SITE.url}${routes.terms()}` },
};

export default function TermsPage() {
  return (
    <ContentPage title="Terms and conditions" description="Terms for browsing, purchasing and downloading Creative Hatti digital resources.">
      <section>
        <h2>Using the marketplace</h2>
        <p>Product descriptions, file details, price options, and license information are presented on their product pages. Review those details before placing an order. Product availability and download access may change according to the order and the product&apos;s configured files.</p>
      </section>
      <section>
        <h2>Accounts and downloads</h2>
        <p>Keep account credentials and guest purchase links private. Account pages and download links are intended to give access to purchases associated with the signed-in customer or the relevant secure guest capability.</p>
      </section>
      <section>
        <h2>Licenses and intellectual property</h2>
        <p>Purchasing an asset grants the rights described by the license selected for that product; it does not automatically transfer copyright or exclusive ownership. Unless expressly permitted by the applicable license, customers may not resell or redistribute original source files as standalone assets. Read the <a href={routes.licenseInformation()}>license information</a> and any product-specific restrictions before use.</p>
        <p>Images of identifiable people and third-party material may have additional usage restrictions, including editorial-only use where applicable.</p>
      </section>
      <section>
        <h2>Custom design projects</h2>
        <p>Custom design projects are arranged separately from the digital product checkout. Before work begins, Creative Hatti and the customer must agree in writing on the brief, deliverables, fees, payment milestones, revisions, timelines, cancellation terms, and any intellectual property transfer. Existing project agreements retain their own terms. For enquiries, use the <a href={routes.contact()}>Contact page</a>.</p>
      </section>
      <section>
        <h2>Payments and product delivery</h2>
        <p>Payments are handled through the payment method shown at checkout. Digital access is associated with the order after the relevant payment and order checks complete. If an order or file appears incorrect, contact the team through the <a href={routes.contact()}>Contact page</a>.</p>
      </section>
      
      
    </ContentPage>
  );
}
