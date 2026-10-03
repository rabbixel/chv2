import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Use the repository's TypeScript compiler so tests work without a new runner dependency.
const source = await readFile(new URL("../lib/seasonal-searches.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { getSeasonalSearches, seasonalEvents, evergreenSearches } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const names = (date, config) => getSeasonalSearches(new Date(date), config).map((item) => item.name);

for (const [date, expected, expired] of [
  ["2026-01-15", "Republic Day", "New Year"],
  ["2026-03-01", "Holi", "Maha Shivratri"],
  ["2026-08-01", "Raksha Bandhan", "Father's Day"],
  ["2026-10-02", "Diwali", "Ganesh Chaturthi"],
  ["2026-11-12", "Chhath Puja", "Dhanteras"],
  ["2026-12-15", "Christmas", "Diwali"],
]) {
  test(`${date}: upcoming occasions appear and expired ones disappear`, () => {
    const result = names(date);
    assert.ok(result.includes(expected));
    assert.ok(!result.includes(expired));
    assert.equal(result.length, 8);
  });
}

test("October 2 selection is seasonal with two evergreen searches", () => {
  assert.deepEqual(names("2026-10-02"), ["Gandhi Jayanti", "Navratri", "Dussehra", "Karwa Chauth", "Dhanteras", "Diwali", "Logo Templates", "Banner Designs"]);
});

test("India midnight changes eligibility even when UTC is on the previous day", () => {
  const config = { events: [{ name: "Boundary", searchQuery: "Boundary", date: "2026-10-20", showBeforeDays: 0, showAfterDays: 0 }] };
  assert.ok(!names("2026-10-19T18:29:59Z", config).includes("Boundary"));
  assert.ok(names("2026-10-19T18:30:00Z", config).includes("Boundary"));
  assert.ok(names("2026-10-20T18:29:59Z", config).includes("Boundary"));
  assert.ok(!names("2026-10-20T18:30:00Z", config).includes("Boundary"));
});

test("45-day preparation and 3-day follow-up boundaries are inclusive", () => {
  const config = { events: [{ name: "Diwali", searchQuery: "Diwali", date: "2026-11-08" }] };
  assert.ok(!names("2026-09-23", config).includes("Diwali"));
  assert.ok(names("2026-09-24", config).includes("Diwali"));
  assert.ok(names("2026-11-11", config).includes("Diwali"));
  assert.ok(!names("2026-11-12", config).includes("Diwali"));
});

test("multi-day occasions remain visible through their end and follow-up", () => {
  const config = { events: seasonalEvents.filter((event) => event.name === "Ramadan") };
  assert.equal(names("2026-03-20", config)[0], "Ramadan");
  assert.ok(names("2026-03-23", config).includes("Ramadan"));
  assert.ok(!names("2026-03-24", config).includes("Ramadan"));
});

test("proximity outranks priority, with priority breaking equal-distance ties", () => {
  const events = [
    { name: "Far", searchQuery: "far", date: "2026-10-20", priority: 100 },
    { name: "Near", searchQuery: "near", date: "2026-10-03", priority: 0 },
    { name: "Near priority", searchQuery: "near priority", date: "2026-10-03", priority: 10 },
  ];
  assert.deepEqual(names("2026-10-02", { events }).slice(0, 3), ["Near priority", "Near", "Far"]);
});

test("explicit future-year entries do not recycle expired lunar dates", () => {
  assert.ok(names("2026-12-25").includes("New Year"));
  assert.ok(names("2027-01-01").includes("Republic Day"));
  assert.deepEqual(names("2027-10-02"), evergreenSearches.map((item) => item.name));
  const events = [{ name: "Diwali", searchQuery: "Diwali", date: "2027-10-29" }];
  assert.equal(names("2027-10-02", { events })[0], "Diwali");
});

test("manual source overrides auto selection, honors order and fills empty slots", () => {
  const manual = [
    { name: "Second", searchQuery: "second", displayOrder: 2 },
    { name: "Hidden", searchQuery: "hidden", enabled: false },
    { name: "First", searchQuery: "first", displayOrder: 1 },
    { name: "Duplicate", searchQuery: "FIRST" },
  ];
  // Give duplicate the same display order so the original explicit choice wins.
  manual[3].displayOrder = 3;
  const result = names("2026-10-02", { manual });
  assert.deepEqual(result.slice(0, 2), ["First", "Second"]);
  assert.equal(result.length, 8);
  assert.ok(!result.includes("Diwali"));
  assert.deepEqual(names("2026-10-02", { manual: [] }), evergreenSearches.map((item) => item.name));
});

test("featured choices, disabled selection and empty API pools have safe fallbacks", () => {
  assert.equal(names("2026-10-02", { featured: [{ name: "Spotlight", searchQuery: "spotlight" }] })[0], "Spotlight");
  assert.deepEqual(names("2026-10-02", { enabled: false }), evergreenSearches.map((item) => item.name));
  assert.equal(names("2026-10-02", { events: [], evergreen: [] }).length, 8);
});

test("invalid/reversed dates and disabled events never create chips", () => {
  const events = [
    { name: "Invalid", searchQuery: "invalid", date: "2026-02-30" },
    { name: "Reversed", searchQuery: "reversed", date: "2026-10-20", endDate: "2026-10-01" },
    { name: "Disabled", searchQuery: "disabled", date: "2026-10-02", enabled: false },
  ];
  assert.deepEqual(names("2026-10-02", { events }), evergreenSearches.map((item) => item.name));
  assert.throws(() => getSeasonalSearches(new Date("invalid")), RangeError);
});

test("every day of 2026 returns eight unique links with at least two evergreen choices", () => {
  const evergreen = new Set(evergreenSearches.map((item) => item.searchQuery));
  for (let day = 0; day < 365; day++) {
    const result = getSeasonalSearches(new Date(Date.UTC(2026, 0, 1 + day)));
    assert.equal(result.length, 8);
    assert.equal(new Set(result.map((item) => item.searchQuery.toLowerCase())).size, 8);
    assert.ok(result.filter((item) => evergreen.has(item.searchQuery)).length >= 2);
  }
});
