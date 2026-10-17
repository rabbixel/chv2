export class AuthServiceUnavailableError extends Error {
  readonly code: "auth_service_unavailable";
}
export function isTransientAuthFailure(error: unknown): boolean;
