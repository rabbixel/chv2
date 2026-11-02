import type { Metadata } from "next";
import { ContentPage } from "@/components/content";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Creative Hatti handles account, order, payment, and digital download information.",
  alternates: { canonical: `${SITE.url}${routes.privacy()}` },
};

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy policy" description="How we use information to provide Creative Hatti accounts, purchases, and digital downloads.">
      <section>
        <h2>Information we collect</h2>
        <p>When you register, sign in, contact us, or place an order, we process information such as your name, email address, account credentials, billing details, purchased products, order history, and support correspondence. We also process technical information needed to maintain sessions, protect the storefront, and deliver downloads, which may include IP addresses, browser information, and security logs.</p>
        <p>Cart contents, wishlist selections, and certain interface preferences may be stored in cookies or your browser. Information supplied in a custom design enquiry is used to respond to that enquiry.</p>
      </section>
      <section>
        <h2>How we use information</h2>
        <p>We use information to manage accounts, authenticate customers, process orders, verify payments, provide access to purchased digital files, answer support requests, prevent abuse, and maintain business and transaction records. We may also use information to meet applicable legal, accounting, and tax obligations.</p>
      </section>
      <section>
        <h2>Payments and service providers</h2>
        <p>Our storefront uses a WordPress and Easy Digital Downloads backend to manage catalogue and order information. Razorpay supports online payment processing. We receive payment status and transaction references needed to reconcile orders; payment details entered into a payment provider&apos;s interface are handled under that provider&apos;s applicable terms and privacy practices.</p>
        <p>Digital product files are stored using Amazon S3 and delivered through controlled download access. The storefront is built with Next.js and hosted through Vercel. Our website and supporting infrastructure providers may process the information needed to operate, secure, and deliver these services. We do not sell customer personal information.</p>
      </section>
      <section>
        <h2>Cookies and browser storage</h2>
        <p>Cookies and similar storage help keep you signed in, maintain carts and wishlists, support checkout security, and remember recent searches or display preferences. Disabling essential cookies may prevent account and purchase features from working correctly. Any optional analytics or advertising technologies, if enabled, should be described in a corresponding notice or consent control.</p>
      </section>
      <section>
        <h2>Sharing and security</h2>
        <p>We share information with service providers only as needed to operate the storefront, fulfill purchases, support customers, or comply with legal requirements. We use access controls and secure download mechanisms to reduce unauthorized access. No internet service can guarantee absolute security; please keep your password and purchase access links confidential.</p>
      </section>
      <section>
        <h2>Retention and your choices</h2>
        <p>We retain account, order, and related information for as long as reasonably needed to provide services, maintain transaction records, resolve disputes, and comply with applicable obligations. Different categories of records may be retained for different periods. You may request access to, correction of, or deletion of your personal information, subject to applicable law and records we must retain.</p>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>We may update this policy when our services or legal obligations change. The current version will be available on this page. For privacy questions or data requests, contact <a href={routes.contactEmail("Privacy request")}>hello@creativehatti.com</a> or visit our <a href={routes.contact()}>Contact page</a>.</p>
      </section>
    </ContentPage>
  );
}
