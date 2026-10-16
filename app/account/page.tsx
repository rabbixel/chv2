import type { Metadata } from "next";
import Link from "next/link";
import { DownloadButton } from "@/components/account";
import { Badge, Card } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import {
  getDownloadService,
  getOrderService,
  getWishlistService,
  isWordPressAuthEnabled,
} from "@/lib/services";
import { getSessionUser } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/utils";
import styles from "./section.module.css";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Creative Hatti account dashboard.",
  alternates: { canonical: `${SITE.url}/account` },
};

export default async function AccountDashboardPage() {
  const wordpressAuth = isWordPressAuthEnabled();
  const [user, orders, downloads, wishlist] = await Promise.all([
    getSessionUser(),
    wordpressAuth
      ? Promise.resolve(null)
      : getOrderService().listOrders({ pageSize: 50 }),
    wordpressAuth ? Promise.resolve([]) : getDownloadService().listDownloads(),
    getWishlistService().getWishlist(),
  ]);

  const recentOrders = orders?.items.slice(0, 3) ?? [];
  const recentDownloads = downloads.slice(0, 3);
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ")
    : "";

  const purchaseStats = wordpressAuth
    ? []
    : [
        {
          label: "Orders",
          value: String(orders?.pagination.totalItems ?? 0),
          href: routes.accountOrders(),
          link: "View orders",
        },
        {
          label: "Downloads",
          value: String(downloads.length),
          href: routes.accountDownloads(),
          link: "View downloads",
        },
      ];
  const stats = [
    ...purchaseStats,
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
        {wordpressAuth
          ? "Your Creative Hatti account."
          : "Everything you own and love at Creative Hatti, in one place."}
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
        <Card>
          <p className={styles.statValue}>{displayName || "—"}</p>
          <p className={styles.statLabel}>{user?.email ?? ""}</p>
          <Link href={routes.accountProfile()} className={styles.statLink}>
            View profile
          </Link>
        </Card>
      </div>
      {wordpressAuth ? (
        <Card>
          <p className={styles.rowTitle}>
            Purchase history is not connected yet
          </p>
          <p className={styles.rowMeta}>
            Your account is signed in. Orders, downloads and licenses will
            appear here after those services are connected.
          </p>
        </Card>
      ) : (
        <div className={styles.split}>
          <section aria-label="Recent orders">
            <h2 className={styles.splitTitle}>Recent orders</h2>
            <div className={styles.list}>
              {recentOrders.map((order) => (
                <Card key={order.id}>
                  <div className={styles.row}>
                    <div className={styles.rowMain}>
                      <p className={styles.rowTitle}>
                        <Link href={routes.accountOrder(order.id)}>
                          {order.number}
                        </Link>
                      </p>
                      <p className={styles.rowMeta}>
                        {formatDate(order.createdAt)} ·{" "}
                        {formatMoney(order.grandTotal)}
                      </p>
                    </div>
                    <div className={styles.rowSide}>
                      <Badge
                        variant={
                          order.status === "paid" ? "success" : "neutral"
                        }
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
          <section aria-label="Recent downloads">
            <h2 className={styles.splitTitle}>Recent downloads</h2>
            <div className={styles.list}>
              {recentDownloads.map((download) => (
                <Card key={download.id}>
                  <div className={styles.row}>
                    <div className={styles.rowMain}>
                      <p className={styles.rowTitle}>{download.productTitle}</p>
                      <p className={styles.rowMeta}>{download.fileName}</p>
                    </div>
                    <div className={styles.rowSide}>
                      <DownloadButton
                        productId={download.productId}
                        orderId={download.orderId}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
