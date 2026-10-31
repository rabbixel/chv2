import Link from "next/link";
import Image from "next/image";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import styles from "./SiteFooter.module.css";

interface FooterSection {
  heading: string;
  links: Array<{ label: string; href: string }>;
}

const SECTIONS: FooterSection[] = [
  {
    heading: "Marketplace",
    links: [
      { label: "All categories", href: routes.categories() },
      { label: "New arrivals", href: routes.newArrivals() },
      { label: "Popular", href: routes.popular() },
      { label: "Free downloads", href: routes.freeDownloads() },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Contact", href: routes.contact() },
      { label: "Help centre", href: routes.help() },
      { label: "FAQs", href: routes.faqs() },
      { label: "Refund policy", href: routes.refundPolicy() },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Login", href: routes.login() },
      { label: "Orders", href: routes.login(routes.accountOrders()) },
      { label: "Downloads", href: routes.login(routes.accountDownloads()) },
      { label: "Wishlist", href: routes.login(routes.accountWishlist()) },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: routes.about() },
      { label: "Clients", href: routes.trustedBy() },
      { label: "Terms", href: routes.terms() },
      { label: "Privacy", href: routes.privacy() },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`ch-container ch-container--wide ${styles.grid}`}>
        <div className={styles.brand}>
          <Link href={routes.home()} aria-label={`${SITE.name} — home`} className={styles.logoLink}>
            <Image src="/brand/creative-hatti-logo.png" alt={SITE.name} width={200} height={49} className={styles.logo} />
          </Link>
          <p className={styles.blurb}>{SITE.description}</p>
          <p className={styles.meta}>
            Prices in {SITE.currency} · Secure checkout
          </p>
        </div>
        {SECTIONS.map((section) => (
          <nav key={section.heading} aria-label={section.heading} className={styles.column}>
            <p className={styles.heading}>{section.heading}</p>
            <ul className={styles.list}>
              {section.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className={styles.bottom}>
        <div className={`ch-container ch-container--wide ${styles.bottomInner}`}>
          <p>© 2026 {SITE.name}. All rights reserved.</p>
          <p>Digital Downloads · Secure Checkout</p>
        </div>
      </div>
    </footer>
  );
}
