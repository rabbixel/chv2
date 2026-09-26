import { products } from "@/data/products";
import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type {
  Cart,
  ID,
  Order,
  OrderCustomer,
  OrderItem,
  OrderStatus,
  Paginated,
  PaginationParams,
} from "@/lib/types";
import { normalizePaginationParams, paginateItems } from "@/lib/utils";

export interface CreateOrderInput {
  customer: OrderCustomer;
  cart: Cart;
}

export interface VerifyPaymentInput {
  orderId: ID;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

export interface OrderService {
  listOrders(params?: PaginationParams): Promise<Paginated<Order>>;
  getOrderById(id: ID): Promise<Order | null>;
  createOrder(input: CreateOrderInput): Promise<Order>;
  markOrderPaid(id: ID, reference: string): Promise<Order | null>;
  markOrderFailed(id: ID, reason: string): Promise<Order | null>;
  markOrderCancelled(id: ID): Promise<Order | null>;
  /**
   * Verify a Razorpay payment with the backend (signature check + capture).
   * Real-backend only — mock mode drives states through the test sandbox.
   */
  verifyPayment(input: VerifyPaymentInput): Promise<Order>;
}

function orderItem(productId: ID, license: OrderItem["license"]): OrderItem {
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error(`Mock product ${productId} not found`);
  return {
    productId: product.id,
    productSlug: product.slug,
    title: product.title,
    license,
    quantity: 1,
    unitPrice: product.price,
    lineTotal: product.price,
  };
}

function mockOrders(): Order[] {
  const firstItems = [orderItem("prod-republic-day-bundle", "commercial")];
  const secondItems = [
    orderItem("prod-ramayana-gods-bundle", "personal"),
    orderItem("prod-logo-template-collection", "personal"),
  ];
  const thirdItems = [
    orderItem("prod-grand-diwali-collection", "commercial"),
    orderItem("prod-festive-instagram-kit", "personal"),
  ];
  const fourthItems = [orderItem("prod-navratri-nights-bundle", "personal")];
  const total = (items: OrderItem[]) =>
    items.reduce((sum, item) => sum + item.lineTotal.amount, 0);

  return [
    {
      id: "ord-0004",
      number: "CH-2026-004315",
      customerId: "customer-guest",
      currency: "INR",
      items: fourthItems,
      subtotal: { amount: total(fourthItems), currency: "INR" },
      discountTotal: { amount: 0, currency: "INR" },
      taxTotal: { amount: 0, currency: "INR" },
      grandTotal: { amount: total(fourthItems), currency: "INR" },
      status: "failed",
      payment: {
        provider: "razorpay",
        status: "failed",
        failureReason: "Card declined by the issuing bank.",
      },
      createdAt: "2026-09-22T16:40:00.000Z",
      updatedAt: "2026-09-22T16:41:00.000Z",
    },
    {
      id: "ord-0003",
      number: "CH-2026-004301",
      customerId: "customer-guest",
      currency: "INR",
      items: thirdItems,
      subtotal: { amount: total(thirdItems), currency: "INR" },
      discountTotal: { amount: 0, currency: "INR" },
      taxTotal: { amount: 0, currency: "INR" },
      grandTotal: { amount: total(thirdItems), currency: "INR" },
      status: "paid",
      payment: {
        provider: "razorpay",
        status: "captured",
        reference: "pay_mock_0003",
      },
      createdAt: "2026-09-18T11:02:00.000Z",
      updatedAt: "2026-09-18T11:04:00.000Z",
    },
    {
      id: "ord-0002",
      number: "CH-2026-004213",
      customerId: "customer-guest",
      currency: "INR",
      items: secondItems,
      subtotal: { amount: total(secondItems), currency: "INR" },
      discountTotal: { amount: 0, currency: "INR" },
      taxTotal: { amount: 0, currency: "INR" },
      grandTotal: { amount: total(secondItems), currency: "INR" },
      status: "paid",
      payment: {
        provider: "razorpay",
        status: "captured",
        reference: "pay_mock_0002",
      },
      createdAt: "2026-09-10T09:30:00.000Z",
      updatedAt: "2026-09-10T09:31:00.000Z",
    },
    {
      id: "ord-0001",
      number: "CH-2026-004102",
      customerId: "customer-guest",
      currency: "INR",
      items: firstItems,
      subtotal: { amount: total(firstItems), currency: "INR" },
      discountTotal: { amount: 0, currency: "INR" },
      taxTotal: { amount: 0, currency: "INR" },
      grandTotal: { amount: total(firstItems), currency: "INR" },
      status: "paid",
      payment: {
        provider: "razorpay",
        status: "captured",
        reference: "pay_mock_0001",
      },
      createdAt: "2026-08-28T14:05:00.000Z",
      updatedAt: "2026-08-28T14:06:00.000Z",
    },
  ];
}

/** In-memory mock orders (single process; the backend persists for real). */
const orderStore = new Map<ID, Order>();
let orderSeq = 0;

function newOrderId(): ID {
  orderSeq += 1;
  return `ord-${Date.now().toString(36)}-${orderSeq}`;
}

function newOrderNumber(): string {
  return `CH-2026-${String(4300 + orderSeq).padStart(6, "0")}`;
}

function transition(order: Order, status: OrderStatus): Order | null {
  // Only pending orders move; paid/failed/cancelled are terminal and the
  // shopper retries via a fresh order (the cart survives until payment).
  if (order.status !== "pending") return null;
  const next: Order = {
    ...order,
    status,
    updatedAt: new Date().toISOString(),
  };
  orderStore.set(order.id, next);
  return next;
}

class MockOrderService implements OrderService {
  async listOrders(params: PaginationParams = {}): Promise<Paginated<Order>> {
    const { page, pageSize } = normalizePaginationParams(params);
    return paginateItems(mockOrders(), page, pageSize);
  }

  async getOrderById(id: ID): Promise<Order | null> {
    return orderStore.get(id) ?? mockOrders().find((order) => order.id === id) ?? null;
  }

  async createOrder(input: CreateOrderInput): Promise<Order> {
    if (input.cart.items.length === 0) {
      throw new Error("The cart is empty.");
    }
    const id = newOrderId();
    const items: OrderItem[] = input.cart.items.map((item) => ({
      productId: item.productId,
      productSlug: item.productSlug,
      title: item.title,
      license: item.license,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    }));
    const now = new Date().toISOString();
    const order: Order = {
      id,
      number: newOrderNumber(),
      customerId: "customer-guest",
      currency: input.cart.currency,
      items,
      subtotal: input.cart.subtotal,
      discountTotal: input.cart.discount ?? {
        amount: 0,
        currency: input.cart.currency,
      },
      taxTotal: { amount: 0, currency: input.cart.currency },
      grandTotal: input.cart.total,
      status: "pending",
      customer: input.customer,
      payment: { provider: "razorpay", status: "pending" },
      createdAt: now,
      updatedAt: now,
    };
    orderStore.set(id, order);
    return order;
  }

  async markOrderPaid(id: ID, reference: string): Promise<Order | null> {
    const order = orderStore.get(id);
    if (!order) return null;
    const next = transition(order, "paid");
    if (!next) return null;
    next.payment = { provider: "razorpay", status: "captured", reference };
    orderStore.set(id, next);
    return next;
  }

  async markOrderFailed(id: ID, reason: string): Promise<Order | null> {
    const order = orderStore.get(id);
    if (!order) return null;
    const next = transition(order, "failed");
    if (!next) return null;
    next.payment = {
      provider: "razorpay",
      status: "failed",
      failureReason: reason,
    };
    orderStore.set(id, next);
    return next;
  }

  async markOrderCancelled(id: ID): Promise<Order | null> {
    const order = orderStore.get(id);
    if (!order) return null;
    return transition(order, "cancelled");
  }

  async verifyPayment(): Promise<Order> {
    throw new Error(
      "Payment verification needs the real backend. Mock mode drives payment states through the test sandbox.",
    );
  }
}

class ApiOrderService implements OrderService {
  listOrders(params: PaginationParams = {}): Promise<Paginated<Order>> {
    const { page, pageSize } = normalizePaginationParams(params);
    return apiFetch<Paginated<Order>>(apiEndpoints.orders.list, {
      searchParams: { page, pageSize },
    });
  }

  async getOrderById(id: ID): Promise<Order | null> {
    try {
      return await apiFetch<Order>(apiEndpoints.orders.detail(id));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  createOrder(input: CreateOrderInput): Promise<Order> {
    return apiFetch<Order>(apiEndpoints.checkout, {
      method: "POST",
      body: input,
    });
  }

  markOrderPaid(id: ID, reference: string): Promise<Order | null> {
    return apiFetch<Order>(apiEndpoints.orders.detail(id), {
      method: "PATCH",
      body: { status: "paid", reference },
    });
  }

  markOrderFailed(id: ID, reason: string): Promise<Order | null> {
    return apiFetch<Order>(apiEndpoints.orders.detail(id), {
      method: "PATCH",
      body: { status: "failed", reason },
    });
  }

  markOrderCancelled(id: ID): Promise<Order | null> {
    return apiFetch<Order>(apiEndpoints.orders.detail(id), {
      method: "PATCH",
      body: { status: "cancelled" },
    });
  }

  verifyPayment(input: VerifyPaymentInput): Promise<Order> {
    return apiFetch<Order>(apiEndpoints.payments.verify, {
      method: "POST",
      body: input,
    });
  }
}

let cached: OrderService | null = null;

export function getOrderService(): OrderService {
  cached ??=
    process.env.USE_MOCK_API === "false"
      ? new ApiOrderService()
      : new MockOrderService();
  return cached;
}
