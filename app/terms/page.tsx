import type { Metadata } from "next";
import { ContentPage } from "@/components/content";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: "Draft terms for using Creative Hatti and its digital products.",
  alternates: { canonical: `${SITE.url}${routes.terms()}` },
};

export default function TermsPage() {
  return (
    <ContentPage title="Terms and conditions" description="Draft terms for browsing and purchasing digital resources." policyDraft>
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
        <p>The historical license information describes a perpetual, non-exclusive Standard License where that license was granted, and says that the same graphic may be purchased by other customers. It restricts redistribution or resale of source files, trademark use, and certain online templates. Historical Extended/Team terms describe additional rights for specified uses. Review the <a href={routes.licenseInformation()}>license information draft</a> and confirm the applicable terms for the product and price option before use. A technical purchase limit does not transfer copyright or create exclusive ownership.</p>
        <p>The historical Terms also state that images or illustrations featuring a celebrity, politician, artist, or other person without a commercial release are for editorial use only. Product-specific labeling and the current scope of those restrictions require owner confirmation.</p>
      </section>
      <section>
        <h2>Commissioned custom design projects — draft for new projects</h2>
        <p>To discuss a custom commission, email <a href={routes.contactEmail("Creative Hatti custom design inquiry")}>hello@creativehatti.com</a>. The website checkout does not automatically create or take payment for a custom project. Before work begins, the customer and Creative Hatti must agree in writing on the approved brief, price, scope, final deliverables, and project terms. A 50% advance is due before work starts, and the remaining 50% is due before delivery of final files. Any additional charge or scope change must be approved before the additional work proceeds. Email delivery is not confirmed by the website.</p>
        <p>Two revision rounds within the approved brief are included in the agreed price. Further revisions or significant changes may incur an additional charge only with the customer&apos;s prior approval. No fixed turnaround time or extra revision fee is promised here.</p>
        <p>For a new project, exclusive rights to the original commissioned design transfer after full payment under a written copyright assignment that identifies the final deliverables and the rights being assigned. The assignment cannot grant rights Creative Hatti does not hold. Third-party fonts, stock assets, software, trademarks, and other externally licensed materials remain subject to their own terms. Editable/source files, preliminary concepts, and rejected drafts are included only as specified in the written project agreement.</p>
        <p>Custom work is generally non-refundable after work begins, subject to applicable law. Before work starts, cancellation requests are reviewed under the written project terms and applicable law; the advance is not automatically forfeited. Remedies required by law, including where agreed services are not provided, are not excluded. These draft terms apply to new projects only and do not change historical agreements or customer rights.</p>
      </section>
      <section>
        <h2>Payments and product delivery</h2>
        <p>Payments are handled through the payment method shown at checkout. Digital access is associated with the order after the relevant payment and order checks complete. If an order or file appears incorrect, contact the team through the <a href={routes.contact()}>Contact page</a>.</p>
      </section>
      <section>
        <h2>Legacy service terms to reconcile</h2>
        <p>The existing WordPress Terms also describe a limited, non-transferable, revocable license to use the service and contain user-submitted-content and seller/community provisions. Confirm which clauses remain relevant to the current storefront before adopting or removing them.</p>
      </section>
      <section>
        <h2>Owner approval needed</h2>
        <p>This draft does not establish governing law, dispute handling, liability limits, warranties, acceptable-use rules, creator warranties, tax treatment, or the final license grant. Copyright assignment scope and formalities, third-party materials, unfinished work, and any permission for Creative Hatti to display commissioned work in a portfolio require legal review and a written decision. The owner must review and approve these terms before publication.</p>
      </section>
    </ContentPage>
  );
}
