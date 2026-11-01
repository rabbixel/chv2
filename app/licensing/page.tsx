import type { Metadata } from "next";
import { ContentPage } from "@/components/content";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Licensing Information | Creative Hatti",
  description: "Understand how you can use Creative Hatti digital artwork, including permitted uses, restrictions, editorial content, and custom designs.",
  alternates: { canonical: `${SITE.url}${routes.licenseInformation()}` },
};

export default function LicensingPage() {
  return (
    <ContentPage
      title="Licensing information"
      description="Understand the rights that come with your Creative Hatti digital artwork and how to use your downloads responsibly."
    >
      <section>
        <h2>How your license works</h2>
        <p>When you download or purchase a Creative Hatti product, you receive permission to use the artwork under the license applicable to that product and the option selected at checkout. You are purchasing usage rights, not ownership of the original copyright, unless a separate written agreement expressly provides otherwise.</p>
        <p>Check the product description, selected license or price option, and any terms supplied with the download. Those product-specific terms define the permitted scope of use. If a product has special restrictions, they apply in addition to this general information.</p>
      </section>
      <section>
        <h2>Standard use of artwork</h2>
        <p>For artwork supplied under a Standard License, Creative Hatti grants a non-exclusive, non-transferable right to use and adapt the purchased design in permitted finished projects, subject to the applicable product terms. The license does not expire merely because the original file is no longer offered for sale, unless the specific license states a different duration.</p>
        <p>Non-exclusive means the same artwork may be licensed to other customers. You may incorporate licensed artwork into a finished design, but you may not distribute the underlying artwork as a reusable standalone asset.</p>
      </section>
      <section>
        <h2>Extended, Team and other license options</h2>
        <p>Some products may offer additional licensing options for uses such as wider team access, multiple client projects, merchandise, or templates. These permissions apply only when expressly included in the option you purchase or in a separate written license. Buying a higher-priced option does not automatically grant exclusivity or copyright ownership.</p>
        <p>Where an option does not clearly cover your intended use, please <a href={routes.contact()}>contact Creative Hatti</a> before using the artwork in that way.</p>
      </section>
      <section>
        <h2>What is not permitted without additional permission</h2>
        <ul>
          <li>Reselling, sublicensing, sharing, or redistributing the original artwork or editable source files as standalone assets, whether modified or unmodified.</li>
          <li>Uploading the artwork to stock libraries, asset marketplaces, or other services where others can obtain the artwork itself.</li>
          <li>Using the artwork as a logo, registered trademark, or exclusive brand identifier without an express written grant of the necessary rights.</li>
          <li>Including the artwork as an extractable or reusable element in templates, design kits, or other products for resale unless the purchased license expressly allows it.</li>
          <li>Sharing downloadable files or account access with people outside the users or team covered by the purchased license.</li>
        </ul>
        <p>Editing, recoloring, or combining an asset with other elements does not remove these restrictions.</p>
      </section>
      <section>
        <h2>Editorial-use content and third-party rights</h2>
        <p>Artwork identified as <strong>Editorial Use Only</strong> is intended for editorial contexts such as news reporting, commentary, educational material, documentaries, and other informational publications. Do not use editorial-only content to advertise or endorse products, services, or organizations without obtaining the necessary permissions.</p>
        <p>A Creative Hatti license does not grant rights to third-party trademarks, brand names, personal likenesses, or other protected material depicted in an illustration. You are responsible for obtaining any additional permissions required for your intended use.</p>
      </section>
      <section>
        <h2>Ownership, exclusivity and purchase limits</h2>
        <p>Unless expressly agreed otherwise in writing, Creative Hatti or the relevant rights holder retains copyright in the underlying artwork. A product being available for only one purchase, or later being removed from sale, does not by itself make the purchase exclusive or transfer copyright.</p>
      </section>
      <section>
        <h2>Custom-commissioned designs</h2>
        <p>Custom design projects are governed by their individual written agreements. Where an agreement provides for assignment of exclusive rights to an original final design, those rights transfer only as specified in the signed assignment and subject to its payment and delivery conditions.</p>
        <p>Third-party fonts, stock assets, software, trademarks, and other externally licensed elements remain subject to their respective licenses. Editable files, unused concepts, and rejected drafts are included only if the written project agreement says so.</p>
      </section>
      <section>
        <h2>Orders, downloads and license questions</h2>
        <p>Keep your order confirmation as a record of the product and option purchased. A software activation status shown in your account is not a statement about your design usage rights. For questions about a particular product, commercial use, team access, or additional permissions, please <a href={routes.contact()}>contact us</a> with the product name and order number.</p>
        <p>These general licensing terms do not override a separate written agreement or the specific license supplied with a product. They do not remove rights or remedies that applicable law gives you.</p>
      </section>
    </ContentPage>
  );
}
