import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountProductArtwork, CustomerDownloadActions, DownloadButton } from "@/components/account";
import { Badge, Card, EmptyState } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import {
  getCustomerDownloadService,
  getCustomerOrderService,
  getDownloadService,
  getOrderService,
  getWishlistService,
  isWordPressAuthEnabled,
} from "@/lib/services";
import { getSessionUser } from "@/lib/auth";
import { resolveProductImagesByUrl } from "@/lib/services/productService";
import type { CustomerDownloadPurchase, CustomerOrder, Order, ProductImage, Wishlist } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";
import styles from "./section.module.css";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Creative Hatti account dashboard.",
  alternates: { canonical: `${SITE.url}/account` },
};

export default async function AccountDashboardPage() {
  if (isWordPressAuthEnabled()) {
    const [userResult, orderResult, downloadResult, wishlistResult] = await Promise.allSettled([
      getSessionUser(),
      getCustomerOrderService().list({ page: 1, pageSize: 5 }),
      getCustomerDownloadService().list({ page: 1, pageSize: 5 }),
      getWishlistService().getWishlist(),
    ]);
    const failed = [userResult, orderResult, downloadResult, wishlistResult]
      .filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failed.some(({ reason }) => reason instanceof ApiError && reason.status === 401)) {
      redirect(routes.login(routes.account()));
    }

    const orders = orderResult.status === "fulfilled" ? orderResult.value : null;
    const downloads = downloadResult.status === "fulfilled" ? downloadResult.value : null;
    const wishlist = wishlistResult.status === "fulfilled" ? wishlistResult.value : null;
    const user = userResult.status === "fulfilled" ? userResult.value : null;
    const imageMap = downloads
      ? await resolveProductImagesByUrl(downloads.items.flatMap((purchase) => purchase.items.map((item) => item.productUrl)))
      : new Map<string, ProductImage>();

    return (
      <WordPressDashboard
        firstName={user?.firstName ?? ""}
        displayName={user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : ""}
        email={user?.email ?? ""}
        orders={orders?.items ?? null}
        orderCount={orders?.pagination.totalItems ?? null}
        downloads={downloads?.items ?? null}
        downloadOrderCount={downloads?.pagination.totalItems ?? null}
        wishlist={wishlist}
        productImages={imageMap}
      />
    );
  }

  const [user, orders, downloads, wishlist] = await Promise.all([
    getSessionUser(),
    getOrderService().listOrders({ pageSize: 50 }),
    getDownloadService().listDownloads(),
    getWishlistService().getWishlist(),
  ]);

  const recentOrders = orders.items.slice(0, 3);
  const recentDownloads = downloads.slice(0, 3);
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ")
    : "";
  const stats = [
    { label: "Orders", value: String(orders.pagination.totalItems), href: routes.accountOrders(), link: "View orders" },
    { label: "Downloads", value: String(downloads.length), href: routes.accountDownloads(), link: "View downloads" },
    { label: "Wishlist", value: String(wishlist.items.length), href: routes.accountWishlist(), link: "View wishlist" },
  ];

  return (
    <div>
      <h1 className={styles.title}>Namaste{user ? `, ${user.firstName}` : ""}</h1>
      <p className={styles.lede}>Everything you own and love at Creative Hatti, in one place.</p>
      <div className={styles.cards}>
        {stats.map((stat) => (
          <Card key={stat.label} className={styles.summaryCard}>
            <p className={styles.statValue}>{stat.value}</p>
            <p className={styles.statLabel}>{stat.label}</p>
            <Link href={stat.href} className={styles.statLink}>{stat.link}</Link>
          </Card>
        ))}
        <ProfileCard displayName={displayName || "—"} email={user?.email ?? ""} />
      </div>
      <div className={styles.split}>
        <section aria-label="Recent orders">
          <h2 className={styles.splitTitle}>Recent orders</h2>
          {recentOrders.length ? <div className={styles.list}>{recentOrders.map((order) => (
            <MockOrderRow key={order.id} order={order} />
          ))}</div> : <EmptyState title="No orders yet" description="Orders you place will appear here." action={<Link href={routes.accountOrders()}>View orders</Link>} />}
        </section>
        <section aria-label="Recent downloads">
          <h2 className={styles.splitTitle}>Recent downloads</h2>
          {recentDownloads.length ? <div className={styles.list}>{recentDownloads.map((download) => (
            <Card key={download.id}>
              <div className={`${styles.row} ${styles.dashboardRow}`}>
                <div className={styles.rowMain}>
                  <p className={styles.rowTitle}>{download.productTitle}</p>
                  <p className={styles.rowMeta}>{download.fileName}</p>
                </div>
                <div className={styles.rowSide}><DownloadButton productId={download.productId} orderId={download.orderId} /></div>
              </div>
            </Card>
          ))}</div> : <EmptyState title="No downloads yet" description="Files from your paid orders will appear here." action={<Link href={routes.accountDownloads()}>View downloads</Link>} />}
        </section>
      </div>
    </div>
  );
}

function ProfileCard({ displayName, email }: { displayName: string; email: string }) {
  return (
    <Card className={styles.profileCard}>
      <p className={styles.statValue}>{displayName}</p>
      <p className={styles.statLabel}>{email}</p>
      <Link href={routes.accountProfile()} className={styles.statLink}>View profile</Link>
    </Card>
  );
}

function WordPressDashboard({
  firstName, displayName, email, orders, orderCount, downloads, downloadOrderCount, wishlist, productImages,
}: {
  firstName: string;
  displayName: string;
  email: string;
  orders: CustomerOrder[] | null;
  orderCount: number | null;
  downloads: CustomerDownloadPurchase[] | null;
  downloadOrderCount: number | null;
  wishlist: Wishlist | null;
  productImages: Map<string, ProductImage>;
}) {
  const recentItems = downloads?.flatMap((purchase) =>
    purchase.items.map((item) => ({ purchase, item })),
  ).slice(0, 3) ?? [];
  const stats = [
    { label: "Orders", value: orderCount === null ? "—" : String(orderCount), href: routes.accountOrders(), link: "View orders" },
    { label: "Download orders", value: downloadOrderCount === null ? "—" : String(downloadOrderCount), href: routes.accountDownloads(), link: "View downloads" },
    { label: "Wishlist", value: wishlist ? String(wishlist.items.length) : "—", href: routes.accountWishlist(), link: "View wishlist" },
  ];

  return (
    <div>
      <h1 className={styles.title}>Namaste{firstName ? `, ${firstName}` : ""}</h1>
      <p className={styles.lede}>Your Creative Hatti account.</p>
      <div className={styles.cards}>
        {stats.map((stat) => (
          <Card key={stat.label} className={styles.summaryCard}>
            <p className={styles.statValue}>{stat.value}</p>
            <p className={styles.statLabel}>{stat.label}</p>
            <Link href={stat.href} className={styles.statLink}>{stat.link}</Link>
          </Card>
        ))}
        <ProfileCard displayName={displayName || "—"} email={email} />
      </div>
      <div className={styles.split}>
        <section aria-label="Recent orders">
          <h2 className={styles.splitTitle}>Recent orders</h2>
          {orders === null ? (
            <EmptyState title="Orders could not be loaded" description="Please refresh the page or try again shortly." />
          ) : orders.length ? (
            <div className={styles.list}>{orders.slice(0, 3).map((order) => (
              <Card key={order.id}>
                <div className={`${styles.row} ${styles.dashboardRow}`}>
                  <div className={styles.rowMain}>
                    <p className={styles.rowTitle}><Link href={routes.accountOrder(order.id)}>{order.number}</Link></p>
                    <p className={styles.rowMeta}>{formatDate(order.date)} · {formatMoney(order.total)}</p>
                  </div>
                  <div className={styles.rowSide}><Badge className={styles.dashboardStatus} variant={order.status === "complete" ? "success" : "neutral"}>{order.status.replaceAll("_", " ")}</Badge></div>
                </div>
              </Card>
            ))}</div>
          ) : <EmptyState title="No orders yet" description="Orders you place will appear here." action={<Link href={routes.accountOrders()}>View orders</Link>} />}
        </section>
        <section className={styles.recentPurchases} aria-label="Recent purchased products">
          <h2 className={styles.splitTitle}>Recent purchased products</h2>
          {downloads === null ? (
            <EmptyState title="Purchase history could not be loaded" description="Please refresh the page or try again shortly." />
          ) : recentItems.length ? (
            <div className={styles.list}>{recentItems.map(({ purchase, item }) => (
              <Card key={item.orderItemId}>
                <div className={`${styles.row} ${styles.purchaseRow}`}>
                  <AccountProductArtwork title={item.title} image={item.productUrl ? productImages.get(item.productUrl) : undefined} fallbackUrl={item.thumbnailUrl} />
                  <div className={styles.rowMain}>
                    <p className={styles.rowTitle}>{item.productUrl ? <Link href={item.productUrl}>{item.title}</Link> : item.title}</p>
                    <p className={styles.rowMeta}>Order <Link href={routes.accountOrder(purchase.orderId)}>{purchase.orderNumber}</Link> · {item.entitledFileCount} file{item.entitledFileCount === 1 ? "" : "s"}</p>
                  </div>
                  <div className={styles.purchaseActions}><CustomerDownloadActions item={item} /></div>
                </div>
              </Card>
            ))}</div>
          ) : <EmptyState title="No completed purchases yet" description="Products from completed orders will appear here." action={<Link href={routes.accountDownloads()}>View downloads</Link>} />}
        </section>
      </div>
    </div>
  );
}

function MockOrderRow({ order }: { order: Order }) {
  return (
    <Card>
      <div className={`${styles.row} ${styles.dashboardRow}`}>
        <div className={styles.rowMain}>
          <p className={styles.rowTitle}><Link href={routes.accountOrder(order.id)}>{order.number}</Link></p>
          <p className={styles.rowMeta}>{formatDate(order.createdAt)} · {formatMoney(order.grandTotal)}</p>
        </div>
        <div className={styles.rowSide}><Badge className={styles.dashboardStatus} variant={order.status === "paid" ? "success" : "neutral"}>{order.status}</Badge></div>
      </div>
    </Card>
  );
}
