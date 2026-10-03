# Seasonal Popular Searches

The homepage calls `getHomepageService().getPopularSearches()` on the server.
Both mock and API homepage services currently use `lib/seasonal-searches.ts`.
The chip component receives `{ name, searchQuery }` entries and builds real
search links through `routes.search()`. Its styling is unchanged. Hero search
suggestions reuse the selected queries. Header suggestions retain their existing
independent navigation configuration.

## Calendar and selection

`SeasonalEvent` contains `name`, `searchQuery`, a year-specific ISO `date`, optional
`endDate`, `showBeforeDays` (default 45), `showAfterDays` (default 3), `priority`,
`displayOrder` and `enabled`. The 2026 calendar covers the requested major
occasions, including Ramadan as a date range. New Year and Republic Day have
explicit 2027 entries for the December/January transition. Add verified future
year dates; lunar festivals are never inferred from the previous year's dates.

Selection converts the current instant into an Asia/Kolkata calendar day, then
compares whole calendar days. Visibility boundaries are inclusive. Events are
ranked by distance to their event/date range (current occasions have distance
zero), descending priority, display order and original source order. Recently
finished festivals remain eligible only through their follow-up window.

Up to six seasonal/featured choices are followed by evergreen search links to
fill eight slots. During quieter periods, additional evergreen choices fill
the row. Duplicate queries or labels are removed. An empty source still uses
the built-in evergreen pool. The homepage revalidates hourly even in mock mode;
existing API caches can shorten this to one minute. ISR updates occur on visits,
so the first request after expiry can receive the previous cached page.

## Add an occasion

Add an entry to `seasonalEvents`, for example:

```ts
{ name: "Occasion", searchQuery: "Occasion", date: "2027-07-10",
  showBeforeDays: 30, showAfterDays: 3, priority: 10 }
```

Use a separate entry for each year. `endDate` supports multi-day celebrations.
To stop a candidate appearing, set `enabled: false`.

## Future WordPress source

No WordPress or API changes are included. When a future endpoint exists, adapt
its response in `ApiHomepageService.getPopularSearches()` and call
`getSeasonalSearches(now, source)`. `SeasonalSearchSource` accepts:

- `events`: dated candidates replacing the local calendar.
- `evergreen`: preferred fallback terms, supplemented by built-in defaults.
- `featured`: explicit first choices, sharing the six-seasonal-choice limit.
- `manual`: overrides automatic selection; list order or `displayOrder` controls
  ordering, with evergreen padding for a short/empty list.
- `enabled: false`: disables automatic seasonal selection while keeping fallback
  links, so the section never becomes empty.

The component needs no changes when the source changes. Source entries support
individual `enabled` flags and `displayOrder`.

## Date references

- [Government 2026 holiday calendar](https://www.mpa.gov.in/sites/default/files/mpacalendar2026_5.0.pdf): national holidays, Holi, Eid, Janmashtami, Dussehra, Diwali, Govardhan Puja and Guru Nanak Jayanti.
- [Government 2026 panchang](https://www.lbsnaa.gov.in/quick-links-files/1773735865.pdf): Vasant Panchami, Maha Shivratri, Raksha Bandhan, Ganesh Chaturthi and Chhath Puja.
- [Drik Panchang 2026 calendar](https://www.drikpanchang.com/calendars/indian/indiancalendar.html?lang=en): Hindu festival and family occasion reference.
- [Karwa Chauth](https://www.drikpanchang.com/festivals/karwa-chauth/karwa-chauth-date-time.html?geoname-id=1266794) and [Dhanteras](https://www.drikpanchang.com/festivals/dhanteras/festivals-dhanteras-puja-timings.html?geoname-id=1259184).
- [India 2026 observances](https://www.timeanddate.com/holidays/india/2026?hol=16): Ramadan start and family observances.

Dates are an editorial India calendar, not local puja timings. Regional lunar
observances and Islamic moon sightings can differ; edit year-specific entries
as needed. No external calendar feed is queried at runtime.

## Verification

`npm run test:seasonal` tests January, March, August, October, November and
December, India midnight boundaries, preparation/expiry boundaries, date ranges,
proximity sorting, cross-year transitions, future API/manual overrides, invalid
data, and all 365 days of 2026. It uses Node's built-in test runner and the
existing TypeScript compiler without adding dependencies.
