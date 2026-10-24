import type { Metadata } from "next";
import { ContentPage } from "@/components/content";
import { Button } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Contact Creative Hatti",
  description: "Contact Creative Hatti about product questions, order access, or support.",
  alternates: { canonical: `${SITE.url}${routes.contact()}` },
};

export default function ContactPage() {
  return (
    <ContentPage title="Contact" description="For product questions, order access, or help with a download, contact the Creative Hatti team.">
      <section>
        <h2>Email</h2>
        <p>Email <a href={routes.contactEmail()}>hello@creativehatti.com</a> for product questions and support.</p>
        <p>This link opens your email application. The website does not confirm whether an email was sent or received.</p>
        <Button href={routes.contactEmail("Creative Hatti support")}>Email Creative Hatti</Button>
      </section>
      <section>
        <h2>Custom design enquiries</h2>
        <p>Creative Hatti accepts commissioned custom design enquiries. To discuss a new project, email <a href={routes.contactEmail("Creative Hatti custom design inquiry")}>hello@creativehatti.com</a> with a short description of the brief. The website does not take custom-project orders or payments automatically; scope, deliverables, price, and terms must be agreed in writing before work begins. Email delivery has not been verified by the website.</p>
      </section>
      <section>
        <h2>For order or download questions</h2>
        <p>Include the order number and product title so the team can identify the issue. Do not email passwords, full payment-card details, or guest access links.</p>
        <p>Signed-in customers can also review <a href={routes.accountOrders()}>Orders</a> and <a href={routes.accountDownloads()}>Downloads</a> in their account.</p>
      </section>
    </ContentPage>
  );
}
