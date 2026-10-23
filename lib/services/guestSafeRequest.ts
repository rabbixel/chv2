import "server-only";

import { ApiError, apiFetch, type ApiFetchOptions } from "@/lib/api/client";
import { getWordPressBridgeHeaders, getWordPressOptionalSessionBridgeHeaders } from "./authService";

/** Retry a guest-safe bridge request without identity only after WP rejects an expired session. */
export async function guestSafeApiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const sessionHeaders = await getWordPressOptionalSessionBridgeHeaders();
  const headers = { ...sessionHeaders, ...options.headers };
  try {
    return await apiFetch<T>(path, { ...options, headers });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401 && error.code === "invalid_session" && headers.Authorization)) throw error;
    return apiFetch<T>(path, { ...options, headers: { ...getWordPressBridgeHeaders(), ...options.headers } });
  }
}
