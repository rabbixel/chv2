/** Shared primitives used across the domain model. */

/** Opaque entity identifier (UUID/ULID from the backend). */
export type ID = string;

/** URL-safe unique slug, e.g. `hand-drawn-diwali-patterns`. */
export type Slug = string;

/** ISO 8601 timestamp, e.g. `2026-09-24T08:00:00.000Z`. */
export type ISODateString = string;

/** ISO 4217 currency code, e.g. `INR`, `USD`. */
export type CurrencyCode = string;

/**
 * Money is always represented as integer minor units (paise/cents) to avoid
 * floating-point errors. Use `formatMoney()` from `lib/utils` to render.
 */
export interface Money {
  amount: number;
  currency: CurrencyCode;
}
