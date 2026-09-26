import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getOrderService } from "@/lib/services";
import { formatDate, formatMoney } from "@/lib/utils";
import styles from "../section.module.css";

export const metadata: Metadata = {
  title: "Orders",
  description: "Your Creative Hatti orders.",
  alternates: { canonical: `${SITE.url}/account/orders` },
};

export default async function AccountOrdersPage() {
  const orders = await getOrderService().listOrders({ pageSize: 50 });

  return (
    <div>
      <h1 className={styles.title}>Orders</h1>
      <p className={styles.lede}>
        Every purchase, with its payment status and download access.
      </p>
      {orders.items.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="When you buy a vector, bundle or template, it will show up here."
          action={<Button href={routes.search()}>Browse products</Button>}
        />
      ) : (
        <div className={styles.list}>
          {orders.items.map((order) => (
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
                    {order.items.length}{" "}
                    {order.items.length === 1 ? "product" : "products"} ·{" "}
                    {formatMoney(order.grandTotal)}
                  </p>
                </div>
                <div className={styles.rowSide}>
                  <Badge
                    variant={order.status === "paid" ? "success" : "neutral"}
                  >
                    {order.status}
                  </Badge>
                  <Link href={routes.accountOrder(order.id)}>View order</Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
