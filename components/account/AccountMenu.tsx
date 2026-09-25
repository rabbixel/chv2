import Link from "next/link";
import { logoutAction } from "@/app/account/actions";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import styles from "./AccountMenu.module.css";

export type AccountSection =
  | "dashboard"
  | "profile"
  | "orders"
  | "downloads"
  | "wishlist"
  | "licenses"
  | "settings";

export interface AccountMenuProps {
  active?: AccountSection;
}

const LINKS: Array<{ key: AccountSection; label: string; href: string }> = [
  { key: "dashboard", label: "Dashboard", href: routes.account() },
  { key: "profile", label: "Profile", href: routes.accountProfile() },
  { key: "orders", label: "Orders", href: routes.accountOrders() },
  { key: "downloads", label: "Downloads", href: routes.accountDownloads() },
  { key: "wishlist", label: "Wishlist", href: routes.accountWishlist() },
  { key: "licenses", label: "Licenses", href: routes.accountLicenses() },
  { key: "settings", label: "Settings", href: routes.accountSettings() },
];

export function AccountMenu({ active = "dashboard" }: AccountMenuProps) {
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
        <li className={styles.logoutItem}>
          <form action={logoutAction}>
            <button type="submit" className={cn(styles.link, styles.logout)}>
              Log out
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
