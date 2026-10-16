import "server-only";

import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { CustomerLicense } from "@/lib/types/customerLicense";
import type { Paginated, PaginationParams } from "@/lib/types/pagination";
import { normalizePaginationParams } from "@/lib/utils";
import { getWordPressSessionBridgeHeaders } from "./authService";

interface WordPressLicense {
  id: number;
  product_id: number;
  product_title: string;
  product_url: string | null;
  product_available: boolean;
  status: string;
  purchase_id: number | null;
  purchase_number: string | null;
  activation_count: number;
  activation_limit: number | null;
  expires_at: string | null;
  lifetime: boolean;
  masked_key: string | null;
}

interface Envelope {
  success: boolean;
  data: WordPressLicense[];
  pagination?: {
    page: number; page_size: number; total_items: number; total_pages: number;
    has_next_page: boolean; has_prev_page: boolean;
  };
}

export interface CustomerLicenseService {
  list(params?: PaginationParams): Promise<Paginated<CustomerLicense>>;
}

class WordPressCustomerLicenseService implements CustomerLicenseService {
  async list(params: PaginationParams = {}): Promise<Paginated<CustomerLicense>> {
    const { page, pageSize } = normalizePaginationParams(params, 20);
    const response = await apiFetch<Envelope>(apiEndpoints.customer.licenses, {
      searchParams: { page, per_page: Math.min(pageSize, 50) },
      headers: await getWordPressSessionBridgeHeaders(),
      cache: "no-store", redirect: "error", timeoutMs: 10_000,
    });
    const pagination = response.pagination;
    if (!pagination) throw new ApiError(502, "invalid_response", "Invalid licenses response.");
    return {
      items: response.data.map((license) => ({
        id: String(license.id), productId: String(license.product_id),
        productTitle: license.product_title, productUrl: license.product_url,
        productAvailable: license.product_available, status: license.status,
        purchaseId: license.purchase_id ? String(license.purchase_id) : null,
        purchaseNumber: license.purchase_number,
        activationCount: license.activation_count,
        activationLimit: license.activation_limit,
        expiresAt: license.expires_at, lifetime: license.lifetime,
        maskedKey: license.masked_key,
      })),
      pagination: {
        page: pagination.page, pageSize: pagination.page_size,
        totalItems: pagination.total_items,
        totalPages: Math.max(1, pagination.total_pages),
        hasNextPage: pagination.has_next_page,
        hasPrevPage: pagination.has_prev_page,
      },
    };
  }
}

let cached: CustomerLicenseService | null = null;
export function getCustomerLicenseService(): CustomerLicenseService {
  cached ??= new WordPressCustomerLicenseService();
  return cached;
}
