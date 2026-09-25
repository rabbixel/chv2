import { products } from "@/data/products";
import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type {
  ID,
  Order,
  OrderItem,
  Paginated,
  PaginationParams,
} from "@/lib/types";
import { normalizePaginationParams, paginateItems } from "@/lib/utils";

export interface OrderService {
  listOrders(params?: PaginationParams): Promise<Paginated<Order>>;
  getOrderById(id: ID): Promise<Order | null>;
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
  const total = (items: OrderItem[]) =>
    items.reduce((sum, item) => sum + item.lineTotal.amount, 0);

  return [
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

class MockOrderService implements OrderService {
  async listOrders(params: PaginationParams = {}): Promise<Paginated<Order>> {
    const { page, pageSize } = normalizePaginationParams(params);
    return paginateItems(mockOrders(), page, pageSize);
  }

  async getOrderById(id: ID): Promise<Order | null> {
    return mockOrders().find((order) => order.id === id) ?? null;
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
}

let cached: OrderService | null = null;

export function getOrderService(): OrderService {
  cached ??=
    process.env.USE_MOCK_API === "false"
      ? new ApiOrderService()
      : new MockOrderService();
  return cached;
}
