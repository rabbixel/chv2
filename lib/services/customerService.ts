import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type { Customer } from "@/lib/types";
import { getAuthService } from "./authService";

export interface CustomerService {
  /** Currently signed-in customer, or `null` when signed out. */
  getCurrentCustomer(): Promise<Customer | null>;
}

/** Mock session: delegates to the auth service session cookie. */
class MockCustomerService implements CustomerService {
  async getCurrentCustomer(): Promise<Customer | null> {
    return getAuthService().getCurrentUser();
  }
}

class ApiCustomerService implements CustomerService {
  getCurrentCustomer(): Promise<Customer | null> {
    return apiFetch<Customer | null>(apiEndpoints.customer.me);
  }
}

let cached: CustomerService | null = null;

export function getCustomerService(): CustomerService {
  cached ??=
    process.env.USE_MOCK_API === "false"
      ? new ApiCustomerService()
      : new MockCustomerService();
  return cached;
}
