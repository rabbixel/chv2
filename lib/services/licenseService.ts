import { licenses } from "@/data/licenses";
import { products } from "@/data/products";
import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { cacheTags, REVALIDATE_SECONDS } from "@/lib/cache";
import type {
  ID,
  License,
  LicenseCode,
  OwnedLicense,
  Slug,
} from "@/lib/types";

export interface LicenseService {
  listLicenses(): Promise<License[]>;
  getLicensesByCodes(codes: LicenseCode[]): Promise<License[]>;
  /** License keys the signed-in customer owns (one per paid order line). */
  listOwnedLicenses(): Promise<OwnedLicense[]>;
}

/**
 * Deterministic mock keys (scaffold only). The backend issues and stores
 * real keys; the frontend displays them verbatim and never parses them.
 */
function mockKey(seed: string): string {
  let state = 2166136261;
  for (const char of seed) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let key = "";
  for (let i = 0; i < 12; i++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    key += alphabet[state % alphabet.length];
  }
  return `HATTI-${key.slice(0, 4)}-${key.slice(4, 8)}-${key.slice(8, 12)}`;
}

interface OwnedLicenseSpec {
  productId: ID;
  orderId: ID;
  orderNumber: string;
  license: LicenseCode;
  issuedAt: string;
  expiresAt?: string;
}

const OWNED_SPECS: OwnedLicenseSpec[] = [
  {
    productId: "prod-republic-day-bundle",
    orderId: "ord-0001",
    orderNumber: "CH-2026-004102",
    license: "commercial",
    issuedAt: "2026-08-28T14:06:00.000Z",
  },
  {
    productId: "prod-ramayana-gods-bundle",
    orderId: "ord-0002",
    orderNumber: "CH-2026-004213",
    license: "personal",
    issuedAt: "2026-09-10T09:31:00.000Z",
  },
  {
    productId: "prod-logo-template-collection",
    orderId: "ord-0002",
    orderNumber: "CH-2026-004213",
    license: "personal",
    issuedAt: "2026-09-10T09:31:00.000Z",
  },
  {
    productId: "prod-grand-diwali-collection",
    orderId: "ord-0003",
    orderNumber: "CH-2026-004301",
    license: "commercial",
    issuedAt: "2026-09-18T11:04:00.000Z",
    // Mock backend-supplied expiry demonstrating the conditional UI; the
    // shop defines no expiry policy — the backend owns these values.
    expiresAt: "2027-09-18T11:04:00.000Z",
  },
  {
    productId: "prod-festive-instagram-kit",
    orderId: "ord-0003",
    orderNumber: "CH-2026-004301",
    license: "personal",
    issuedAt: "2026-09-18T11:04:00.000Z",
  },
];

function mockOwnedLicenses(): OwnedLicense[] {
  return OWNED_SPECS.map((spec, index) => {
    const product = products.find((item) => item.id === spec.productId);
    if (!product) throw new Error(`Mock product ${spec.productId} not found`);
    return {
      id: `olk-${String(index + 1).padStart(4, "0")}`,
      key: mockKey(`${spec.orderId}:${spec.productId}`),
      productId: product.id,
      productSlug: product.slug as Slug,
      productTitle: product.title,
      orderId: spec.orderId,
      orderNumber: spec.orderNumber,
      license: spec.license,
      status: "active",
      issuedAt: spec.issuedAt,
      expiresAt: spec.expiresAt,
    } satisfies OwnedLicense;
  });
}

class MockLicenseService implements LicenseService {
  async listLicenses(): Promise<License[]> {
    return [...licenses];
  }

  async getLicensesByCodes(codes: LicenseCode[]): Promise<License[]> {
    const byCode = new Map(licenses.map((license) => [license.code, license]));
    return codes
      .map((code) => byCode.get(code))
      .filter((license): license is License => license !== undefined);
  }

  async listOwnedLicenses(): Promise<OwnedLicense[]> {
    return mockOwnedLicenses();
  }
}

class ApiLicenseService implements LicenseService {
  listLicenses(): Promise<License[]> {
    return apiFetch<License[]>(apiEndpoints.licenses.list, {
      revalidate: REVALIDATE_SECONDS.static,
      tags: [cacheTags.licenses],
    });
  }

  async getLicensesByCodes(codes: LicenseCode[]): Promise<License[]> {
    const all = await this.listLicenses();
    const wanted = new Set(codes);
    return all.filter((license) => wanted.has(license.code));
  }

  listOwnedLicenses(): Promise<OwnedLicense[]> {
    return apiFetch<OwnedLicense[]>(apiEndpoints.licenses.owned);
  }
}

/* --------------------------- Factory --------------------------- */

let cached: LicenseService | null = null;

export function getLicenseService(): LicenseService {
  cached ??=
    process.env.USE_MOCK_API === "false"
      ? new ApiLicenseService()
      : new MockLicenseService();
  return cached;
}
