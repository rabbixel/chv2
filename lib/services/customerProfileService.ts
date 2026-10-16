import "server-only";

import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { CustomerProfile, UpdateCustomerProfileInput } from "@/lib/types/customerProfile";
import { getWordPressSessionBridgeHeaders } from "./authService";

interface WordPressProfile {
  email: string; first_name: string; last_name: string;
  display_name: string; created_at: string;
}
interface Envelope { success: boolean; data: { profile: WordPressProfile } }

function mapProfile(profile: WordPressProfile): CustomerProfile {
  return {
    email: profile.email, firstName: profile.first_name,
    lastName: profile.last_name, displayName: profile.display_name,
    createdAt: profile.created_at,
  };
}

export interface CustomerProfileService {
  get(): Promise<CustomerProfile>;
  update(input: UpdateCustomerProfileInput): Promise<CustomerProfile>;
}

class WordPressCustomerProfileService implements CustomerProfileService {
  async get(): Promise<CustomerProfile> {
    const response = await apiFetch<Envelope>(apiEndpoints.customer.profile, {
      headers: await getWordPressSessionBridgeHeaders(), cache: "no-store",
      redirect: "error", timeoutMs: 10_000,
    });
    return mapProfile(response.data.profile);
  }

  async update(input: UpdateCustomerProfileInput): Promise<CustomerProfile> {
    const response = await apiFetch<Envelope>(apiEndpoints.customer.profile, {
      method: "PATCH", body: { first_name: input.firstName, last_name: input.lastName },
      headers: await getWordPressSessionBridgeHeaders(), cache: "no-store",
      redirect: "error", timeoutMs: 10_000,
    });
    return mapProfile(response.data.profile);
  }
}

let cached: CustomerProfileService | null = null;
export function getCustomerProfileService(): CustomerProfileService {
  cached ??= new WordPressCustomerProfileService();
  return cached;
}
