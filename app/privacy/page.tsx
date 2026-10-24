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
        <p>To operate accounts and purchases, the storefront and WordPress/EDD use customer account details, checkout and billing information, order records, payment references and status, wishlist items, and information needed to authorize downloads. The exact fields retained for each purpose and the retention periods require confirmation before this draft is final.</p>
      </section>
      <section>
        <h2>Services used</h2>
        <p>WordPress and Easy Digital Downloads maintain customer and order records and authorize downloads. Razorpay processes checkout payments; the storefront uses provider payment references and status to reconcile orders. Amazon S3 is used for file delivery through EDD&apos;s authorized download flow. The precise data each service receives, its applicable terms, and any additional WordPress-side providers must be confirmed by the owner.</p>
      </section>
      <section>
        <h2>Accounts, messages, and access</h2>
        <p>Authentication uses server-validated sessions. The Next.js storefront sets HttpOnly session cookies and uses cart and wishlist cookies to support those features; some non-sensitive display-state cookies are readable by the browser. WordPress sends account verification and password-reset messages through its mail function. Successful message delivery depends on mail configuration and is not confirmed by this page.</p>
        <p>Keep your credentials and secure guest purchase links private. Do not send passwords or full payment-card details to support.</p>
      </section>
      <section>
        <h2>Cookies, analytics, and other tracking</h2>
        <p>Cookies support sign-in, cart, wishlist, and account features. No Google Analytics or Facebook Pixel tags were found in the reviewed Next.js application source. That check does not establish whether WordPress plugins, theme settings, or production configuration add analytics, advertising, or other tracking. We do not make a definitive claim about those tools until the complete live setup has been checked.</p>
        <p>Retention periods, legal bases, data-subject request procedures, international transfers, deletion rules, marketing practices, and the complete cookie/provider inventory require owner and legal review. The historical WordPress policy lists financial details including card security information while also stating that sensitive data is not collected; those conflicting statements must not be carried forward without verification.</p>
      </section>
      <section>
        <h2>Questions</h2>
        <p>Use the support details on our <a href={routes.contact()}>Contact page</a> for privacy questions. Email delivery has not been verified. The owner must confirm the responsible legal entity and appropriate privacy contact before this draft is final.</p>
      </section>
    </ContentPage>
  );
}
