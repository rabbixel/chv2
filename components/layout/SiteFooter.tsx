import Link from "next/link";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getCategoryService } from "@/lib/services";
import styles from "./SiteFooter.module.css";

const COMPANY_LINKS = ["About us", "Careers", "Press", "Contact"];
const SUPPORT_LINKS = ["Help centre", "Licensing", "Terms", "Privacy"];
const SELLER_LINKS = ["Become a seller", "Seller handbook", "Payouts"];

export async function SiteFooter() {
  const categories = await getCategoryService().listCategories();

  return (
    <footer className={styles.footer}>
      <div className={`ch-container ${styles.grid}`}>
        <div className={styles.brand}>
          <p className={styles.name}>{SITE.name}</p>
          <p className={styles.blurb}>{SITE.description}</p>
          <p className={styles.meta}>Prices in {SITE.currency} · Secure checkout</p>
        </div>
        <nav aria-label="Marketplace" className={styles.column}>
          <p className={styles.heading}>Marketplace</p>
          <ul className={styles.list}>
            {categories.slice(0, 6).map((category) => (
              <li key={category.id}>
                <Link href={routes.category(category.slug)}>{category.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Company" className={styles.column}>
          <p className={styles.heading}>Company</p>
          <ul className={styles.list}>
            {COMPANY_LINKS.map((label) => (
              <li key={label}>
                {/* Placeholder links — pages land in later runs. */}
                <Link href="#">{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Support" className={styles.column}>
          <p className={styles.heading}>Support</p>
          <ul className={styles.list}>
            {SUPPORT_LINKS.map((label) => (
              <li key={label}>
                <Link href="#">{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Sellers" className={styles.column}>
          <p className={styles.heading}>Sell</p>
          <ul className={styles.list}>
            {SELLER_LINKS.map((label) => (
              <li key={label}>
                <Link href="#">{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className={styles.bottom}>
        <div className={`ch-container ${styles.bottomInner}`}>
          <p>© 2026 {SITE.name}. All rights reserved.</p>
          <p>Crafted in India · GST invoices on every order</p>
        </div>
      </div>
    </footer>
  );
}
