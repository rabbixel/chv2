import { products } from "@/data/products";
import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { Download, ID } from "@/lib/types";

export interface DownloadService {
  listDownloads(): Promise<Download[]>;
  /** Mint a fresh signed URL for a download (backend fulfils via S3). */
  fulfilDownload(id: ID): Promise<Download | null>;
}

function mockDownloads(): Download[] {
  const pick = (productId: ID, orderId: ID, fileName: string, sizeMb: number) => {
    const product = products.find((item) => item.id === productId);
    if (!product) throw new Error(`Mock product ${productId} not found`);
    return { product, orderId, fileName, sizeMb };
  };
  const rows = [
    pick("prod-republic-day-bundle", "ord-0001", "republic-day-bundle.zip", 184),
    pick("prod-ramayana-gods-bundle", "ord-0002", "ramayana-gods-bundle.zip", 342),
    pick("prod-vintage-badge-logos", "ord-0002", "vintage-badge-logos.zip", 96),
  ];
  return rows.map((row, index) => ({
    id: `dl-${String(index + 1).padStart(4, "0")}`,
    orderId: row.orderId,
    productId: row.product.id,
    productSlug: row.product.slug,
    productTitle: row.product.title,
    fileName: row.fileName,
    fileSizeBytes: row.sizeMb * 1024 * 1024,
    downloadCount: index,
    downloadLimit: 10,
    createdAt: "2026-09-10T09:31:00.000Z",
  }));
}

class MockDownloadService implements DownloadService {
  async listDownloads(): Promise<Download[]> {
    return mockDownloads().map((download) => ({ ...download, url: undefined }));
  }

  async fulfilDownload(id: ID): Promise<Download | null> {
    const found = mockDownloads().find((download) => download.id === id);
    if (!found) return null;
    // Mock only: a local placeholder path. Production returns a short-lived
    // signed S3 URL minted by the backend — never constructed client-side.
    return {
      ...found,
      url: `/api/mock-downloads/${found.id}/${found.fileName}`,
      urlExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }
}

class ApiDownloadService implements DownloadService {
  listDownloads(): Promise<Download[]> {
    return apiFetch<Download[]>(apiEndpoints.downloads.list);
  }

  fulfilDownload(id: ID): Promise<Download | null> {
    return apiFetch<Download>(apiEndpoints.downloads.fulfil(id), {
      method: "POST",
    });
  }
}

let cached: DownloadService | null = null;

export function getDownloadService(): DownloadService {
  cached ??=
    process.env.USE_MOCK_API === "false"
      ? new ApiDownloadService()
      : new MockDownloadService();
  return cached;
}
