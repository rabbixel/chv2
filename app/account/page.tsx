import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import {
  getDownloadService,
  getOrderService,
  getWishlistService,
} from "@/lib/services";
import { getSessionUser } from "@/lib/auth";
import styles from "./section.module.css";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Creative Hatti account dashboard.",
  alternates: { canonical: `${SITE.url}/account` },
};

export default async function AccountDashboardPage() {
  const [user, orders, downloads, wishlist] = await Promise.all([
    getSessionUser(),
    getOrderService().listOrders({ pageSize: 50 }),
    getDownloadService().listDownloads(),
    getWishlistService().getWishlist(),
  ]);

  const stats = [
    {
      label: "Orders",
      value: String(orders.pagination.totalItems),
      href: routes.accountOrders(),
      link: "View orders",
    },
    {
      label: "Downloads",
      value: String(downloads.length),
      href: routes.accountDownloads(),
      link: "View downloads",
    },
    {
      label: "Wishlist",
      value: String(wishlist.items.length),
      href: routes.accountWishlist(),
      link: "View wishlist",
    },
  ];

  return (
    <div>
      <h1 className={styles.title}>
        Namaste{user ? `, ${user.firstName}` : ""}
      </h1>
      <p className={styles.lede}>
        Everything you own and love at Creative Hatti, in one place.
      </p>
      <div className={styles.cards}>
        {stats.map((stat) => (
          <Card key={stat.label}>
            <p className={styles.statValue}>{stat.value}</p>
            <p className={styles.statLabel}>{stat.label}</p>
            <Link href={stat.href} className={styles.statLink}>
              {stat.link}
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
