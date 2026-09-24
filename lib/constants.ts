/**
 * Site-wide constants. Browser-safe (no secrets here, ever).
 */

export const SITE = {
  name: "Creative Hatti",
  tagline: "Premium digital creative assets",
  description:
    "Creative Hatti is a curated marketplace for fonts, graphics, templates and design resources.",
  locale: "en-IN",
  currency: "INR",
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000",
} as const;

export const PAGINATION = {
  defaultPageSize: readEnvInt("NEXT_PUBLIC_DEFAULT_PAGE_SIZE", 24, 1, 96),
  maxPageSize: 96,
  /** How many page buttons the Pagination component renders around current. */
  siblingCount: 1,
} as const;

function readEnvInt(
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
