/**
 * Typed HTTP client for the future backend API.
 *
 * Components and pages must NEVER call `fetch` directly against the API —
 * all traffic goes through this client (via the service layer), so base
 * URLs, caching, error shapes and auth headers stay in one place.
 *
 * RUN 01: the mock services don't hit the network yet; this client exists so
 * future runs can swap implementations without touching components.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Query parameters; `undefined`/`null` values are dropped. */
  searchParams?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Next.js ISR window in seconds (GET requests). */
  revalidate?: number | false;
  /** Next.js cache tags for on-demand revalidation. */
  tags?: string[];
}

function resolveBaseUrl(): string {
  // Server-only override wins (may carry internal hostnames); the public var
  // is the browser-safe fallback. Empty during RUN 01 (mock mode).
  return (
    process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
  ).replace(/\/$/, "");
}

export function isApiConfigured(): boolean {
  return resolveBaseUrl().length > 0;
}

export async function apiFetch<TResponse>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<TResponse> {
  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    throw new ApiError(
      503,
      "api_not_configured",
      "Backend API is not configured. The storefront is running on mock data.",
    );
  }

  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    next:
      options.revalidate === undefined && options.tags === undefined
        ? undefined
        : { revalidate: options.revalidate, tags: options.tags },
  });

  if (!response.ok) {
    const payload = await safeJson(response);
    const message =
      (typeof payload?.message === "string" && payload.message) ||
      `Request failed with status ${response.status}`;
    const code =
      (typeof payload?.code === "string" && payload.code) || "request_failed";
    throw new ApiError(response.status, code, message, payload);
  }

  if (response.status === 204) return undefined as TResponse;
  return (await response.json()) as TResponse;
}

async function safeJson(
  response: Response,
): Promise<{ message?: unknown; code?: unknown } | null> {
  try {
    const data: unknown = await response.json();
    if (typeof data === "object" && data !== null) {
      return data as { message?: unknown; code?: unknown };
    }
    return null;
  } catch {
    return null;
  }
}
