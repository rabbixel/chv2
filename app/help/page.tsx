import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Help centre",
  description: "Help with Creative Hatti accounts, orders, payments, licenses, and downloads.",
  alternates: { canonical: `${SITE.url}${routes.help()}` },
};

export default function HelpPage() {
  return (
    <ContentPage title="Help centre" description="Find guidance for using your Creative Hatti account and digital purchases.">
      <section>
        <h2>Account access</h2>
        <p>Sign in to view your orders, downloads, and wishlist. If you bought as a guest, use the secure purchase link from your checkout confirmation in the original browser, or <Link href={routes.claimAccount()}>claim the purchase for an account</Link> after verifying the purchase email.</p>
      </section>
      <section>
        <h2>Downloads</h2>
        <p>For signed-in purchases, open <Link href={routes.accountDownloads()}>Account → Downloads</Link>. Guest access uses an order-scoped capability; keep the confirmation link private. Download links are requested when you click a file and may expire.</p>
        <p>If a link reports that a file is unavailable, contact support with the order number and product title. A listed file does not guarantee that its storage object is currently present.</p>
      </section>
      <section>
        <h2>Payments and orders</h2>
        <p>Orders and their current status appear in <Link href={routes.accountOrders()}>Account → Orders</Link> after sign-in. If a payment or order status looks incorrect, do not place repeated orders; contact the team with the order reference.</p>
      </section>
      <section>
        <h2>Commissioned custom designs</h2>
        <p>To ask about a new custom design, email <a href={routes.contactEmail("Creative Hatti custom design inquiry")}>hello@creativehatti.com</a>. Custom projects require a written brief and agreement. A 50% advance is due before work starts, with the balance due before final files are delivered. Two revision rounds within the approved brief are included; any additional charges or scope changes must be agreed before extra work begins. Custom projects are arranged by email and are not automatically purchased through website checkout. Email delivery is not confirmed by the website.</p>
      </section>
      <section>
        <h2>Licenses and product details</h2>
        <p>License terms can differ by product and price option. Review the license information on the relevant product page before using the files. If a usage right is unclear, ask before purchase.</p>
      </section>
      <section>
        <h2>Still need help?</h2>
        <p>Use the contact details on our <Link href={routes.contact()}>Contact page</Link>.</p>
      </section>
    </ContentPage>
  );
}
