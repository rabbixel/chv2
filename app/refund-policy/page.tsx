import type { Metadata } from "next";
import { ContentPage } from "@/components/content";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Refund policy",
  description: "How to request help with a Creative Hatti order, download, or commissioned project.",
  alternates: { canonical: `${SITE.url}${routes.refundPolicy()}` },
};

export default function RefundPolicyPage() {
  return (
    <ContentPage title="Refund policy" description="How to request help with a Creative Hatti order, download, or commissioned project.">
      <section>
        <h2>Digital products</h2>
        <p>If you cannot access a file, the download is corrupted, the order was charged more than once, or the item differs materially from its description, contact us so we can review the order and help resolve the problem. A download link becoming available does not prevent you from reporting a file that cannot be retrieved or used.</p>
        <p>Because ready-made products are digital, a change-of-mind request after successful delivery may not qualify for a refund. Each request is considered in light of the order details and applicable consumer law. Nothing in this policy limits rights that cannot legally be excluded.</p>
      </section>
      <section>
        <h2>Payment and download problems</h2>
        <p>Email <a href={routes.contactEmail("Refund or order support")}>hello@creativehatti.com</a> with your order number, product title, and a short description of the issue. Do not send passwords, full payment-card details, or private guest download links. We will review the information and let you know the available next steps.</p>
      </section>
      <section>
        <h2>Commissioned custom work</h2>
        <p>Custom design projects follow the scope, payment schedule, cancellation terms, and deliverables agreed in writing before work begins. Contact us promptly if you need to cancel or have a concern about work in progress. Any refund or other remedy will be handled under that agreement and applicable law.</p>
      </section>
      <section>
        <h2>How to contact us</h2>
        <p>For order or refund help, email <a href={routes.contactEmail("Refund or order support")}>hello@creativehatti.com</a> or visit our <a href={routes.contact()}>Contact page</a>. Include only the details needed to identify the order.</p>
      </section>
    </ContentPage>
  );
}
