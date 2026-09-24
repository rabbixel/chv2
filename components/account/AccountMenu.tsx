import Link from "next/link";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import styles from "./AccountMenu.module.css";

export type AccountSection = "orders" | "downloads" | "wishlist" | "overview";

export interface AccountMenuProps {
  active?: AccountSection;
}

const LINKS: Array<{ key: AccountSection; label: string; href: string }> = [
  { key: "overview", label: "Overview", href: routes.account() },
  { key: "orders", label: "Orders", href: routes.accountOrders() },
  { key: "downloads", label: "Downloads", href: routes.accountDownloads() },
  { key: "wishlist", label: "Wishlist", href: routes.wishlist() },
];

export function AccountMenu({ active = "overview" }: AccountMenuProps) {
  return (
    <nav aria-label="Account" className={styles.nav}>
      <ul className={styles.list}>
        {LINKS.map((link) => (
          <li key={link.key}>
            <Link
              href={link.href}
              aria-current={active === link.key ? "page" : undefined}
              className={cn(
                styles.link,
                active === link.key && styles.active,
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
