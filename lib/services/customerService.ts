import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import type {
  Customer,
  NotificationPreferences,
  UpdateProfileInput,
} from "@/lib/types";
import { getAuthService } from "./authService";

export interface CustomerService {
  /** Currently signed-in customer, or `null` when signed out. */
  getCurrentCustomer(): Promise<Customer | null>;
  updateProfile(input: UpdateProfileInput): Promise<Customer>;
  getNotificationPreferences(): Promise<NotificationPreferences>;
  updateNotificationPreferences(
    prefs: NotificationPreferences,
  ): Promise<NotificationPreferences>;
}

/* ------------------------------ Mock ------------------------------ */

const DEFAULT_PREFERENCES: NotificationPreferences = {
  orderUpdates: true,
  newProducts: true,
  offers: false,
};

const preferencesStore = new Map<string, NotificationPreferences>();

/** Mock: identity via the auth session, prefs in a session-side store. */
class MockCustomerService implements CustomerService {
  async getCurrentCustomer(): Promise<Customer | null> {
    return getAuthService().getCurrentUser();
  }

  async updateProfile(input: UpdateProfileInput): Promise<Customer> {
    return getAuthService().updateProfile(input);
  }

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    const user = await getAuthService().getCurrentUser();
    if (!user) return { ...DEFAULT_PREFERENCES };
    return (
      preferencesStore.get(user.id) ?? { ...DEFAULT_PREFERENCES }
    );
  }

  async updateNotificationPreferences(
    prefs: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    const user = await getAuthService().getCurrentUser();
    if (!user) throw new Error("You must be logged in.");
    preferencesStore.set(user.id, { ...prefs });
    return { ...prefs };
  }
}

class ApiCustomerService implements CustomerService {
  getCurrentCustomer(): Promise<Customer | null> {
    return apiFetch<Customer | null>(apiEndpoints.customer.me);
  }

  updateProfile(input: UpdateProfileInput): Promise<Customer> {
    return apiFetch<Customer>(apiEndpoints.customer.me, {
      method: "PATCH",
      body: input,
    });
  }

  getNotificationPreferences(): Promise<NotificationPreferences> {
    return apiFetch<NotificationPreferences>(apiEndpoints.customer.preferences);
  }

  updateNotificationPreferences(
    prefs: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    return apiFetch<NotificationPreferences>(
      apiEndpoints.customer.preferences,
      { method: "PUT", body: prefs },
    );
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
