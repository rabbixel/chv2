import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import {
  getCustomerOrderService,
  getOrderService,
  isWordPressAuthEnabled,
} from "@/lib/services";
import { ApiError } from "@/lib/api/client";
import type { Paginated } from "@/lib/types";
import type { CustomerOrder } from "@/lib/types/customerOrder";
import { receiptActionLabel } from "@/lib/receiptPresentation";
import { formatDate, formatMoney } from "@/lib/utils";
import styles from "../section.module.css";

export const metadata: Metadata = {
  title: "Orders",
  description: "Your Creative Hatti orders.",
  alternates: { canonical: `${SITE.url}/account/orders` },
};

export const dynamic = "force-dynamic";

interface AccountOrdersPageProps {
  searchParams: Promise<{ page?: string | string[] }>;
}

export default async function AccountOrdersPage({ searchParams }: AccountOrdersPageProps) {
  if (isWordPressAuthEnabled()) {
    const query = await searchParams;
    const pageValue = Array.isArray(query.page) ? query.page[0] : query.page;
    const pageNumber = pageValue && /^[1-9][0-9]{0,4}$/.test(pageValue)
      ? Number(pageValue)
      : 1;
    let orders: Paginated<CustomerOrder>;
    try {
      orders = await getCustomerOrderService().list({ page: pageNumber, pageSize: 20 });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirect(routes.login(routes.accountOrders()));
      }
      return (
        <div>
          <h1 className={styles.title}>Orders</h1>
          <EmptyState title="Orders could not be loaded" description="Please refresh the page or try again shortly." />
        </div>
      );
    }

    return <CustomerOrders orders={orders} />;
  }

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

function CustomerOrders({ orders }: { orders: Paginated<CustomerOrder> }) {
  return (
    <div>
      <h1 className={styles.title}>Orders</h1>
      <p className={styles.lede}>Your purchases and their order status.</p>
      {orders.items.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Your purchases will appear here."
          action={<Button href={routes.search()}>Browse products</Button>}
        />
      ) : (
        <>
          <div className={styles.list}>
            {orders.items.map((order) => (
              <Card key={order.id}>
                <div className={styles.row}>
                  <div className={styles.rowMain}>
                    <p className={styles.rowTitle}>
                      <Link href={routes.accountOrder(order.id)}>Order {order.number}</Link>
                    </p>
                    <p className={styles.rowMeta}>
                      {formatDate(order.date)} · {order.items.length} {order.items.length === 1 ? "product" : "products"} · {formatMoney(order.total)}
                    </p>
                  </div>
                  <div className={styles.rowSide}>
                    <Badge variant={order.status === "complete" ? "success" : "neutral"}>{order.status.replaceAll("_", " ")}</Badge>
                    <Link href={routes.accountOrder(order.id)}>View order</Link>
                    <Link href={routes.accountOrderReceipt(order.id)}>{receiptActionLabel(order.status)}</Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {orders.pagination.totalPages > 1 && (
            <nav aria-label="Order pages" className={styles.row}>
              {orders.pagination.hasPrevPage ? <Link href={`${routes.accountOrders()}?page=${orders.pagination.page - 1}`}>Previous</Link> : <span />}
              <span className={styles.rowMeta}>Page {orders.pagination.page} of {orders.pagination.totalPages}</span>
              {orders.pagination.hasNextPage ? <Link href={`${routes.accountOrders()}?page=${orders.pagination.page + 1}`}>Next</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
