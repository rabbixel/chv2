/** Pure editorial selector. The homepage service owns the source; UI receives only chips. */
export interface SearchChip {
  name: string;
  searchQuery: string;
}

export interface SearchChoice extends SearchChip {
  enabled?: boolean;
  displayOrder?: number;
}

export interface SeasonalEvent extends SearchChoice {
  /** Full year-specific ISO date, never an annually repeated lunar month/day. */
  date: string;
  endDate?: string;
  showBeforeDays?: number;
  showAfterDays?: number;
  priority?: number;
}

/** A future API adapter can supply this shape without changing the components. */
export interface SeasonalSearchSource {
  events?: readonly SeasonalEvent[];
  evergreen?: readonly SearchChoice[];
  featured?: readonly SearchChoice[];
  /** Presence overrides automatic selection; an empty list falls back to evergreen. */
  manual?: readonly SearchChoice[];
  /** Disables automatic seasonal entries; evergreen fallback remains available. */
  enabled?: boolean;
}

// India editorial calendar. Sources and maintenance notes: docs/seasonal-searches.md.
// Islamic observances may require an editorial adjustment following moon sighting.
export const seasonalEvents: readonly SeasonalEvent[] = [
  { name: "New Year", searchQuery: "New Year", date: "2026-01-01" },
  { name: "Vasant Panchami", searchQuery: "Vasant Panchami", date: "2026-01-23" },
  { name: "Republic Day", searchQuery: "Republic Day", date: "2026-01-26", priority: 10 },
  { name: "Maha Shivratri", searchQuery: "Maha Shivratri", date: "2026-02-15" },
  { name: "Ramadan", searchQuery: "Ramadan", date: "2026-02-19", endDate: "2026-03-20" },
  { name: "Holi", searchQuery: "Holi", date: "2026-03-04", priority: 10 },
  { name: "Eid", searchQuery: "Eid", date: "2026-03-21" },
  { name: "Baisakhi", searchQuery: "Baisakhi", date: "2026-04-14" },
  { name: "Ambedkar Jayanti", searchQuery: "Ambedkar Jayanti", date: "2026-04-14" },
  { name: "Mother's Day", searchQuery: "Mother's Day", date: "2026-05-10" },
  { name: "Eid al-Adha", searchQuery: "Eid al-Adha", date: "2026-05-27" },
  { name: "Father's Day", searchQuery: "Father's Day", date: "2026-06-21" },
  { name: "Independence Day", searchQuery: "Independence Day", date: "2026-08-15", priority: 10 },
  { name: "Raksha Bandhan", searchQuery: "Raksha Bandhan", date: "2026-08-28" },
  { name: "Janmashtami", searchQuery: "Janmashtami", date: "2026-09-04" },
  { name: "Teachers' Day", searchQuery: "Teachers' Day", date: "2026-09-05" },
  { name: "Ganesh Chaturthi", searchQuery: "Ganesh Chaturthi", date: "2026-09-14", priority: 10 },
  { name: "Gandhi Jayanti", searchQuery: "Gandhi Jayanti", date: "2026-10-02" },
  { name: "Navratri", searchQuery: "Navratri", date: "2026-10-11", endDate: "2026-10-20" },
  { name: "Dussehra", searchQuery: "Dussehra", date: "2026-10-20", priority: 10 },
  { name: "Karwa Chauth", searchQuery: "Karwa Chauth", date: "2026-10-29" },
  { name: "Dhanteras", searchQuery: "Dhanteras", date: "2026-11-06" },
  { name: "Diwali", searchQuery: "Diwali", date: "2026-11-08", priority: 10 },
  { name: "Govardhan Puja", searchQuery: "Govardhan Puja", date: "2026-11-09" },
  { name: "Bhai Dooj", searchQuery: "Bhai Dooj", date: "2026-11-11" },
  { name: "Chhath Puja", searchQuery: "Chhath Puja", date: "2026-11-15" },
  { name: "Guru Nanak Jayanti", searchQuery: "Guru Nanak Jayanti", date: "2026-11-24" },
  { name: "Christmas", searchQuery: "Christmas", date: "2026-12-25" },
  // Explicit cross-year entries for fixed Gregorian occasions only.
  { name: "New Year", searchQuery: "New Year", date: "2027-01-01" },
  { name: "Republic Day", searchQuery: "Republic Day", date: "2027-01-26", priority: 10 },
];

export const evergreenSearches: readonly SearchChoice[] = [
  { name: "Logo Templates", searchQuery: "logo" },
  { name: "Banner Designs", searchQuery: "banner" },
  { name: "Business Characters", searchQuery: "profession" },
  { name: "Social Media Templates", searchQuery: "social media" },
  { name: "Wedding Invitations", searchQuery: "wedding" },
  { name: "Character Bundles", searchQuery: "character bundle" },
  { name: "Business Flyers", searchQuery: "flyer" },
  { name: "Greeting Cards", searchQuery: "greeting card" },
];

const DAY = 86_400_000;
const TOTAL = 8;
const SEASONAL_LIMIT = 6;
const indiaCalendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
});

function calendarDay(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return undefined;
  return timestamp / DAY;
}

function choices(items: readonly SearchChoice[]): SearchChoice[] {
  return items.filter((item) => item.enabled !== false && item.name.trim() && item.searchQuery.trim())
    .toSorted((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

/** Inclusive 45-day preparation / 3-day follow-up windows; proximity outranks priority. */
export function getSeasonalSearches(now = new Date(), source: SeasonalSearchSource = {}): SearchChip[] {
  if (!Number.isFinite(now.getTime())) throw new RangeError("A valid simulation date is required.");
  const today = calendarDay(indiaCalendar.format(now))!;
  const evergreen = [...choices(source.evergreen ?? evergreenSearches), ...evergreenSearches];
  const ranked = (source.events ?? seasonalEvents).flatMap((event, index) => {
    const start = calendarDay(event.date);
    const end = calendarDay(event.endDate ?? event.date);
    const before = event.showBeforeDays ?? 45;
    const after = event.showAfterDays ?? 3;
    if (event.enabled === false || !event.name.trim() || !event.searchQuery.trim()
      || start === undefined || end === undefined || end < start
      || !Number.isFinite(before) || !Number.isFinite(after) || before < 0 || after < 0
      || today < start - before || today > end + after) return [];
    const proximity = today < start ? start - today : today > end ? today - end : 0;
    return [{ event, proximity, index }];
  }).sort((a, b) => a.proximity - b.proximity
    || (b.event.priority ?? 0) - (a.event.priority ?? 0)
    || (a.event.displayOrder ?? 0) - (b.event.displayOrder ?? 0) || a.index - b.index);

  const selected: SearchChip[] = [];
  const seen = new Set<string>();
  const names = new Set<string>();
  function add(item: SearchChoice) {
    const name = item.name.trim();
    const searchQuery = item.searchQuery.trim();
    const key = searchQuery.toLowerCase();
    if (seen.has(key) || names.has(name.toLowerCase())) return;
    seen.add(key);
    names.add(name.toLowerCase());
    selected.push({ name, searchQuery });
  }

  if (source.manual !== undefined) {
    for (const item of choices(source.manual)) {
      if (selected.length >= TOTAL) break;
      add(item);
    }
  } else if (source.enabled !== false) {
    for (const item of [...choices(source.featured ?? []), ...ranked.map(({ event }) => event)]) {
      if (selected.length >= SEASONAL_LIMIT) break;
      add(item);
    }
  }
  for (const item of evergreen) {
    if (selected.length >= TOTAL) break;
    add(item);
  }
  return selected;
}
