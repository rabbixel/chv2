import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content";
import styles from "@/components/content/ContentPage.module.css";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Answers about Creative Hatti digital products, accounts, downloads, and licensing.",
  alternates: { canonical: `${SITE.url}${routes.faqs()}` },
};

export default function FrequentlyAskedQuestionsPage() {
  return (
    <ContentPage title="Frequently asked questions" description="Quick answers about browsing, buying, and accessing Creative Hatti digital resources.">
      <div className={styles.faqList}>
        <details className={styles.faqItem}>
          <summary>How do I receive a digital product?</summary>
          <p>Product pages describe the files and the available purchase or free-download flow. For a completed purchase, signed-in customers can check Account → Downloads; guests should keep their secure checkout confirmation.</p>
        </details>
        <details className={styles.faqItem}>
          <summary>Where can I find a purchase made while signed in?</summary>
          <p>Sign in and open <Link href={routes.accountOrders()}>Orders</Link> or <Link href={routes.accountDownloads()}>Downloads</Link>. Your access remains subject to the order and download rules shown for that purchase.</p>
        </details>
        <details className={styles.faqItem}>
          <summary>Can I use a design for commercial work?</summary>
          <p>Check the license shown on that product page and selected price option. Usage rights vary; do not assume that purchasing a file transfers copyright or grants exclusive ownership. See the <Link href={routes.licenseInformation()}>license information draft</Link>.</p>
        </details>
        <details className={styles.faqItem}>
          <summary>What if a download link does not work?</summary>
          <p>Return to the Downloads page and request a fresh link. If the file still cannot be retrieved, <Link href={routes.contact()}>contact support</Link> with the order number and product title. A download button means access was approved, but it does not confirm that the file is available or has downloaded successfully.</p>
        </details>
        <details className={styles.faqItem}>
          <summary>How do commissioned custom designs work?</summary>
          <p>For new custom projects, a written project agreement sets the brief, deliverables, price, and scope. A 50% advance is due before work starts, and the remaining 50% is due before final files are delivered. Two revision rounds within the approved brief are included; extra revisions or scope changes may have additional charges, agreed with you before that work proceeds. Custom projects are arranged by contacting <Link href={routes.contact()}>Creative Hatti support</Link>; the website does not automatically take custom-project orders or payments.</p>
          <p>For a new project, exclusive rights to the original commissioned design transfer only after full payment and under a written assignment that defines the deliverables and rights. Third-party materials remain subject to their own licenses; editable/source files, preliminary concepts, and rejected drafts are included only if the written agreement says so. Custom work is generally non-refundable after work begins, subject to applicable law. Before work starts, cancellation requests are reviewed under the project terms and applicable law; an advance is not automatically forfeited. These terms apply to new projects and do not change past agreements. This draft requires legal review.</p>
        </details>
        <details className={styles.faqItem}>
          <summary>How do I ask about a refund?</summary>
          <p>Successfully delivered digital products are generally non-refundable, except where applicable law requires a refund or another remedy. If a file is defective, inaccessible, not as described, or not delivered, <Link href={routes.contact()}>contact the team</Link> with your order reference. A download link alone does not prove that the file was delivered. See the <Link href={routes.refundPolicy()}>refund policy draft</Link>; its final wording is subject to legal review.</p>
        </details>
      </div>
    </ContentPage>
  );
}
