import { licenses } from "@/data/licenses";
import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { cacheTags, REVALIDATE_SECONDS } from "@/lib/cache";
import type { License, LicenseCode } from "@/lib/types";

export interface LicenseService {
  listLicenses(): Promise<License[]>;
  getLicensesByCodes(codes: LicenseCode[]): Promise<License[]>;
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
}

class ApiLicenseService implements LicenseService {
  listLicenses(): Promise<License[]> {
    return apiFetch<License[]>(apiEndpoints.licenses, {
      revalidate: REVALIDATE_SECONDS.static,
      tags: [cacheTags.licenses],
    });
  }

  async getLicensesByCodes(codes: LicenseCode[]): Promise<License[]> {
    const all = await this.listLicenses();
    const wanted = new Set(codes);
    return all.filter((license) => wanted.has(license.code));
  }
}

/* --------------------------- Factory --------------------------- */

let cached: LicenseService | null = null;

/** Pages and components consume licenses only through this accessor. */
export function getLicenseService(): LicenseService {
  cached ??=
    process.env.USE_MOCK_API === "false"
      ? new ApiLicenseService()
      : new MockLicenseService();
  return cached;
}
