import type { Metadata } from "next";
import { ContentPage } from "@/components/content";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Refund policy",
  description: "Draft guidance on digital product delivery and refund requests at Creative Hatti.",
  alternates: { canonical: `${SITE.url}${routes.refundPolicy()}` },
};

export default function RefundPolicyPage() {
  return (
    <ContentPage title="Refund policy" description="How to report a problem with a digital order." policyDraft>
      <section>
        <h2>Digital products</h2>
        <p>Successfully delivered digital products are generally non-refundable, except where a refund or another remedy is required by applicable law. If a product is defective, corrupted, inaccessible, materially different from its description, or was not delivered, contact us so we can investigate and provide an appropriate remedy.</p>
        <p>A download button, an EDD authorization, or the creation of a download link confirms that access was authorized. It does not by itself prove that the file reached your device or opened successfully. If the file is missing or cannot be retrieved, report the problem before treating the download as delivered.</p>
      </section>
      <section>
        <h2>Payment and download problems</h2>
        <p>Contact us about payment errors, duplicate charges, missing or corrupted files, or an order that appears paid but is unavailable. Include the order number, product title, and a brief description of the issue. Do not send passwords, full payment-card details, or private guest download links.</p>
        <p>The historical policy says requests are reviewed within five business days. We retain that as a target review period, not a guaranteed decision or refund date; the owner must confirm that this target is operational before publication.</p>
      </section>
      <section>
        <h2>Commissioned custom work</h2>
        <p>Custom projects are governed by the written project agreement, not the ready-made download terms above. For new projects, custom work is generally non-refundable after work begins, subject to applicable law. Before work begins, cancellation requests are reviewed under the agreed project terms and applicable law; the advance is not automatically forfeited. Remedies required by law, including where agreed services are not provided, are not excluded.</p>
        <p>These draft terms do not change historical custom-work agreements. Final wording requires legal review before publication.</p>
      </section>
      <section>
        <h2>How to contact us</h2>
        <p>Use the support details on the <a href={routes.contact()}>Contact page</a>. Email delivery has not been verified by the website, so keep a copy of your message and any payment-provider confirmation.</p>
      </section>
      <section>
        <h2>Past purchases</h2>
        <p>The custom-work terms above apply only to new projects agreed under those terms. They do not change historical custom-work agreements or the terms that applied to ready-made purchases. Historical FAQ statements about custom-work refunds conflict; refer to the written agreement for an existing project, subject to applicable law.</p>
        <p>Applicable statutory consumer rights are not excluded. Final wording requires legal review before production publication.</p>
      </section>
    </ContentPage>
  );
}
