import type { Metadata } from "next";
import { ContentPage } from "@/components/content";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "License information",
  description: "Draft overview of the historical Creative Hatti asset license information.",
  alternates: { canonical: `${SITE.url}${routes.licenseInformation()}` },
};

export default function LicensingPage() {
  return (
    <ContentPage title="License information" description="A draft summary of the licensing terms documented on the previous WordPress storefront." policyDraft>
      <section>
        <h2>Check the applicable license</h2>
        <p>Review the license terms shown for the product and price option before purchase or use. The current connection between EDD price options and the historical Standard or Extended/Team license terms has not been verified for every product. This summary does not assign a license to an option that is unclear.</p>
      </section>
      <section>
        <h2>Standard License in the historical terms</h2>
        <p>The historical agreement says graphics were provided by default under a Standard License, with non-exclusive rights that do not expire. It describes the right as non-transferable and says other customers may purchase and use the same graphic. Where this Standard License was granted, it permits use and modification as stated in the agreement, subject to its limits.</p>
        <p>The historical terms restrict sublicensing or redistributing the original or altered source graphic for resale, using graphics as a trademark or part of a trademark, and placing graphics in online templates for sale under the Standard License. The historical wording about providing files to third parties or a team is broad; confirm the applicable option before sharing files with a team or client.</p>
      </section>
      <section>
        <h2>Extended and Team use in the historical terms</h2>
        <p>The historical agreement describes Team licensing for shared-drive access by team members and use for multiple clients. It describes Extended licensing for uses beyond the Standard terms, including merchandise with material creative or functional elements, certain commercial-space wall art, and images incorporated as elements of digital templates for sale or distribution.</p>
        <p>These are summaries of historical terms. The exact scope and which current EDD price option, if any, grants each right must be confirmed before relying on them.</p>
      </section>
      <section>
        <h2>Purchase limits and ownership</h2>
        <p>A product&apos;s purchase limit is a technical availability rule. It does not by itself grant exclusive rights, transfer copyright, or change a license already granted. Do not infer ownership or exclusivity from a product being limited to one sale.</p>
      </section>
      <section>
        <h2>Editorial-use content</h2>
        <p>The historical Terms and Conditions state that some images or illustrations featuring people may be marked “Editorial Use Only” when a commercial release is not available. The page lists news, archives, publications, documentaries, nonfiction books, and public-service content as examples, and excludes promotional graphics, packaging, advertising, merchandise, and social-media campaigns. Product-specific labels and the current applicability of this legacy rule require owner review.</p>
      </section>
      <section>
        <h2>Commissioned custom designs</h2>
        <p>Ready-made marketplace products remain governed by their applicable Standard or Extended/Team license above. A purchase limit does not create exclusive rights or transfer copyright.</p>
        <p>For a new commissioned design, the approved direction is to transfer exclusive rights to the original final design after full payment under a written copyright assignment. The agreement must define the final deliverables and rights transferred; it cannot grant rights Creative Hatti does not hold. Third-party fonts, stock assets, software, trademarks, and other externally licensed materials remain subject to their own restrictions. Editable/source files, concepts, and rejected drafts are covered only if the written agreement specifies them.</p>
        <p>Custom projects are arranged by contacting the team through the <a href={routes.contact()}>Contact page</a>. These draft terms do not change past custom-work agreements. The assignment, third-party rights, unfinished work, and any portfolio display permission require legal review.</p>
      </section>
      <section>
        <h2>Owner approval needed</h2>
        <p>Confirm current Standard, Team, and Extended scopes; map EDD price options to those terms; confirm editorial-use labeling; and obtain legal review of custom copyright-assignment scope and formalities before removing this draft notice.</p>
      </section>
    </ContentPage>
  );
}
