import "server-only";

import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { CustomerDownloadPurchase } from "@/lib/types/customerDownload";
import type { Paginated, PaginationParams } from "@/lib/types/pagination";
import { normalizePaginationParams } from "@/lib/utils";
import { decodeWordPressPlainText } from "@/lib/creative-hatti/collections";
import { getWordPressSessionBridgeHeaders } from "./authService";

type Availability = CustomerDownloadPurchase["items"][number]["availability"];
interface WordPressDownloadItem {
  order_item_id: number;
  product_id: number;
  title: string;
  thumbnail_url: string | null;
  product_url: string | null;
  price_id: number | null;
  quantity: number;
  entitled_file_count: number;
  availability: Availability;
  download_enabled: false;
}
interface WordPressPurchase {
  order_id: number;
  order_number: string;
  purchase_date: string;
  items: WordPressDownloadItem[];
}
interface WordPressEnvelope<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next_page: boolean;
    has_prev_page: boolean;
  };
}

export interface CustomerDownloadService {
  list(params?: PaginationParams): Promise<Paginated<CustomerDownloadPurchase>>;
}

class WordPressCustomerDownloadService implements CustomerDownloadService {
  async list(params: PaginationParams = {}): Promise<Paginated<CustomerDownloadPurchase>> {
    const { page, pageSize } = normalizePaginationParams(params, 20);
    const result = await apiFetch<WordPressEnvelope<WordPressPurchase[]>>(
      apiEndpoints.customer.downloads,
      {
        searchParams: { page, per_page: Math.min(pageSize, 50) },
        headers: await getWordPressSessionBridgeHeaders(),
        cache: "no-store",
        redirect: "error",
        timeoutMs: 10_000,
      },
    );
    const pagination = result.pagination;
    if (!pagination) throw new ApiError(502, "invalid_response", "Invalid download library response.");
    return {
      items: result.data.map((purchase) => ({
        orderId: String(purchase.order_id),
        orderNumber: purchase.order_number,
        purchaseDate: purchase.purchase_date,
        items: purchase.items.map((item) => ({
          orderItemId: String(item.order_item_id),
          productId: String(item.product_id),
          title: decodeWordPressPlainText(item.title),
          thumbnailUrl: item.thumbnail_url,
          productUrl: item.product_url,
          priceId: item.price_id,
          quantity: item.quantity,
          entitledFileCount: item.entitled_file_count,
          availability: item.availability,
          downloadEnabled: false,
        })),
      })),
      pagination: {
        page: pagination.page,
        pageSize: pagination.page_size,
        totalItems: pagination.total_items,
        totalPages: Math.max(1, pagination.total_pages),
        hasNextPage: pagination.has_next_page,
        hasPrevPage: pagination.has_prev_page,
      },
    };
  }
}

let cached: CustomerDownloadService | null = null;
export function getCustomerDownloadService(): CustomerDownloadService {
  cached ??= new WordPressCustomerDownloadService();
  return cached;
}
