/**
 * Navigation content that will eventually come from the API/database.
 * Centralised here so header, mobile drawer and search suggestions share
 * one source until the backend owns it.
 */

/** Marketplace-popular searches shown in the search dropdown. */
export const popularSearches: string[] = [
  "diwali patterns",
  "wedding invitation",
  "instagram post pack",
  "block print seamless",
  "logo collection",
  "resume template",
  "youtube starter kit",
  "business cards",
];

/** How many primary-nav categories render before the "More" menu. */
export const PRIMARY_NAV_VISIBLE_COUNT = 8;

/** Local-storage key for recent searches (UI-only, never synced). */
export const RECENT_SEARCHES_KEY = "ch-recent-searches";
export const RECENT_SEARCHES_LIMIT = 5;
