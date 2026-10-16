import "server-only";

import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { CustomerOrder } from "@/lib/types/customerOrder";
import type { Paginated, PaginationParams } from "@/lib/types/pagination";
import { normalizePaginationParams } from "@/lib/utils";
import { getWordPressSessionBridgeHeaders } from "./authService";

interface WordPressMoney { amount: number; currency: string }
interface WordPressOrderItem {
  product_id: number; name: string; quantity: number; unit_price: WordPressMoney;
  line_total: WordPressMoney; price_id: number | null; thumbnail_url: string | null;
  product_url: string | null;
}
interface WordPressRefund {
  id: number; number: string; date: string; status: string; subtotal: WordPressMoney;
  discount: WordPressMoney; tax: WordPressMoney; total: WordPressMoney;
}
interface WordPressAdjustment {
  type: string; subtotal: WordPressMoney; tax: WordPressMoney; total: WordPressMoney;
}
interface WordPressOrder {
  id: number; number: string; date: string; status: string; currency: string;
  subtotal: WordPressMoney; discount: WordPressMoney; tax: WordPressMoney;
  total: WordPressMoney; payment_method: string; items: WordPressOrderItem[];
  refunds: WordPressRefund[];
  adjustments: WordPressAdjustment[];
}
interface WordPressEnvelope<T> {
  success: boolean; data: T;
  pagination?: { page: number; page_size: number; total_items: number;
    total_pages: number; has_next_page: boolean; has_prev_page: boolean };
}

export interface CustomerOrderService {
  list(params?: PaginationParams): Promise<Paginated<CustomerOrder>>;
  get(id: string): Promise<CustomerOrder | null>;
}

function mapMoney(value: WordPressMoney) {
  return { amount: value.amount, currency: value.currency };
}

function mapOrder(order: WordPressOrder): CustomerOrder {
  return {
    id: String(order.id), number: order.number, date: order.date,
    status: order.status, currency: order.currency,
    subtotal: mapMoney(order.subtotal), discount: mapMoney(order.discount),
    tax: mapMoney(order.tax), total: mapMoney(order.total),
    paymentMethod: order.payment_method,
    items: order.items.map((item) => ({
      productId: String(item.product_id), name: item.name,
      quantity: item.quantity, unitPrice: mapMoney(item.unit_price),
      lineTotal: mapMoney(item.line_total), priceId: item.price_id,
      thumbnailUrl: item.thumbnail_url, productUrl: item.product_url,
    })),
    refunds: order.refunds.map((refund) => ({
      id: refund.id, number: refund.number, date: refund.date,
      status: refund.status, subtotal: mapMoney(refund.subtotal),
      discount: mapMoney(refund.discount), tax: mapMoney(refund.tax),
      total: mapMoney(refund.total),
    })),
    adjustments: order.adjustments.map((adjustment) => ({
      type: adjustment.type,
      subtotal: mapMoney(adjustment.subtotal),
      tax: mapMoney(adjustment.tax),
      total: mapMoney(adjustment.total),
    })),
  };
}

class WordPressCustomerOrderService implements CustomerOrderService {
  async list(params: PaginationParams = {}): Promise<Paginated<CustomerOrder>> {
    const { page, pageSize } = normalizePaginationParams(params, 20);
    const result = await apiFetch<WordPressEnvelope<WordPressOrder[]>>(
      apiEndpoints.customer.orders,
      {
        searchParams: { page, per_page: Math.min(pageSize, 50) },
        headers: await getWordPressSessionBridgeHeaders(),
        cache: "no-store", redirect: "error", timeoutMs: 10_000,
      },
    );
    const pagination = result.pagination;
    if (!pagination) throw new ApiError(502, "invalid_response", "Invalid order response.");
    return {
      items: result.data.map(mapOrder),
      pagination: {
        page: pagination.page, pageSize: pagination.page_size,
        totalItems: pagination.total_items,
        totalPages: Math.max(1, pagination.total_pages),
        hasNextPage: pagination.has_next_page,
        hasPrevPage: pagination.has_prev_page,
      },
    };
  }

  async get(id: string): Promise<CustomerOrder | null> {
    if (!/^[1-9][0-9]{0,8}$/.test(id)) return null;
    try {
      const result = await apiFetch<WordPressEnvelope<WordPressOrder>>(
        apiEndpoints.customer.order(id),
        {
          headers: await getWordPressSessionBridgeHeaders(),
          cache: "no-store", redirect: "error", timeoutMs: 10_000,
        },
      );
      return mapOrder(result.data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }
}

let cached: CustomerOrderService | null = null;
export function getCustomerOrderService(): CustomerOrderService {
  cached ??= new WordPressCustomerOrderService();
  return cached;
}
