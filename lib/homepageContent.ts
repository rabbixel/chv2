import { discoveryTiles, trendingKeywords } from "./homepage";
import { routes } from "./routes";
import type { Collection } from "./types";

export interface CelebrationSchedule {
  title: string;
  query: string;
  eventDate?: string;
  showFrom?: string;
  hideAfter?: string;
  priority: number;
  pinned?: boolean;
}

// Dates are editorial and year-specific; never repeat lunar festivals by month/day.
export const celebrationSchedule: CelebrationSchedule[] = [
  { title: "Dussehra", query: "dussehra", eventDate: "2026-10-20", priority: 30 },
  { title: "Dhanteras", query: "dhanteras", eventDate: "2026-11-06", priority: 20 },
  { title: "Diwali", query: "diwali", eventDate: "2026-11-08", priority: 10 },
  { title: "Indian Weddings", query: "wedding", priority: 0 },
  { title: "Greeting Cards", query: "greeting card", priority: 0 },
  { title: "Social Media", query: "social media", priority: 0 },
  { title: "Logo Templates", query: "logo", priority: 0 },
];

export function indiaDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function activeCelebrations(now = new Date()): Collection[] {
  const today = indiaDate(now);
  return celebrationSchedule.filter((item) => {
    const event = item.eventDate ? new Date(`${item.eventDate}T00:00:00Z`) : undefined;
    const from = item.showFrom ?? (event ? new Date(event.getTime() - 60 * 86400000).toISOString().slice(0, 10) : "");
    const until = item.hideAfter ?? (event ? new Date(event.getTime() + 2 * 86400000).toISOString().slice(0, 10) : "");
    return (!from || today >= from) && (!until || today <= until);
  }).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)
    || Number(!!b.eventDate) - Number(!!a.eventDate)
    || b.priority - a.priority || (a.eventDate ?? "").localeCompare(b.eventDate ?? ""))
    .slice(0, 10).map((item, index) => ({
      id: `scheduled-${item.query}`, slug: item.query.replaceAll(" ", "-"),
      title: item.title, query: item.query, tagline: "", hue: 150,
      kind: "seasonal", seasonal: true, sortOrder: index,
      href: routes.search(item.query),
    }));
}

export function defaultHomepageContent(now = new Date()) {
  return { discoveryTiles, seasonalCollections: activeCelebrations(now), keywords: trendingKeywords, trustedBrands: [] };
}
