import type { Metadata } from "next";
import { ContentPage } from "@/components/content";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "Draft information about personal information used to operate Creative Hatti.",
  alternates: { canonical: `${SITE.url}${routes.privacy()}` },
};

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy policy" description="Draft overview of information used to operate the Creative Hatti storefront." policyDraft>
      <section>
        <h2>Information used by the storefront</h2>
        <p>To provide accounts and process purchases, Creative Hatti uses customer account details, checkout and billing information, order records, payment references and status, wishlist items, and information needed to manage download access. The exact fields retained for each purpose and the retention periods require confirmation before this draft is final.</p>
      </section>
      <section>
        <h2>Services used</h2>
        <p>Creative Hatti&apos;s account and order systems maintain customer and order records and manage download access. Razorpay processes checkout payments; the storefront uses payment references and status to match payments with orders. Amazon S3 stores and delivers files through the secure download process. The precise data each service receives, its applicable terms, and any additional service providers must be confirmed by the owner.</p>
      </section>
      <section>
        <h2>Accounts, messages, and access</h2>
        <p>Sign-in uses sessions checked by our servers. Cookies support account, cart, and wishlist features; some non-sensitive display preferences are readable by your browser. We send account verification and password-reset messages by email. Successful delivery depends on the email service configuration and is not confirmed by this page.</p>
        <p>Keep your credentials and secure guest purchase links private. Do not send passwords or full payment-card details to support.</p>
      </section>
      <section>
        <h2>Cookies, analytics, and other tracking</h2>
        <p>Cookies support sign-in, cart, wishlist, and account features. No Google Analytics or Facebook Pixel tags were found in the reviewed storefront source. This does not establish whether other site settings or services add analytics, advertising, or tracking. We do not make a definitive claim about those tools until the complete live setup has been checked.</p>
        <p>Retention periods, legal bases, data-request procedures, international transfers, deletion rules, marketing practices, and the complete cookie and service inventory require owner and legal review. The previous privacy policy lists financial details including card security information while also stating that sensitive data is not collected; those conflicting statements must not be carried forward without verification.</p>
      </section>
      <section>
        <h2>Questions</h2>
        <p>Use the support details on our <a href={routes.contact()}>Contact page</a> for privacy questions. Email delivery has not been verified. The owner must confirm the responsible legal entity and appropriate privacy contact before this draft is final.</p>
      </section>
    </ContentPage>
  );
}
