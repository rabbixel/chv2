export class AuthServiceUnavailableError extends Error {
  constructor() {
    super("Authentication is temporarily unavailable. Please try again shortly.");
    this.name = "AuthServiceUnavailableError";
    this.code = "auth_service_unavailable";
  }
}

export function isTransientAuthFailure(error) {
  if (!error || typeof error !== "object") return false;
  const status = error.status;
  if (typeof status === "number") {
    return status === 408 || status === 429 || status >= 500;
  }
  return error.name === "AbortError" || error.name === "TimeoutError" || error instanceof TypeError;
}
