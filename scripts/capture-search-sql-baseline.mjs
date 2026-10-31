import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const base = (process.env.SEARCH_TEST_API_URL ?? "http://creativehatti.test/wp-json/ch/v1/indexed-search").replace(/\/$/, "");
if (!new Set(["creativehatti.test", "localhost", "127.0.0.1"]).has(new URL(base).hostname)) {
  throw new Error("Search SQL baseline capture is restricted to a local WordPress endpoint.");
}
const scenarios = [
  ["broad-diwali", { q: "diwali" }],
  ["broad-indian", { q: "indian" }],
  ["broad-vector", { q: "vector" }],
  ["narrow-dhanteras", { q: "dhanteras" }],
  ["zero-results", { q: "ch-search-no-match-zzqv" }],
  ["category", { q: "diwali", cat: "social-media" }],
  ["free-only", { q: "vector", avail: "free" }],
  ["paid-only", { q: "vector", avail: "paid" }],
  ["landscape", { q: "vector", orientation: "landscape" }],
  ["portrait", { q: "vector", orientation: "portrait" }],
  ["square", { q: "vector", orientation: "square" }],
  ["price-ascending", { q: "vector", sort: "price-asc" }],
  ["price-descending", { q: "vector", sort: "price-desc" }],
  ["relevance", { q: "indian", sort: "relevance" }],
  ["newest", { q: "indian", sort: "newest" }],
  ["best-selling", { q: "indian", sort: "best-selling" }],
  ["combined-filters", { q: "diwali", cat: "social-media", orientation: "landscape", avail: "paid", sort: "price-asc" }],
  ["deep-page", { q: "vector", page: "500", per_page: "24", sort: "newest" }],
  ["special-characters", { q: "goa & beach" }],
  ["out-of-range-page", { q: "vector", page: "50000", per_page: "24" }],
  ["negative-page", { q: "vector", page: "-1" }],
  ["invalid-price-range", { q: "diwali", min: "5000", max: "100" }],
];

const entries = [];
for (const [name, params] of scenarios) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const started = performance.now();
  const response = await fetch(url, { cache: "no-store" });
  const elapsedMs = Math.round(performance.now() - started);
  const body = await response.json();
  if (body && typeof body === "object") delete body.took_ms;
  entries.push({ name, params, status: response.status, elapsedMs, response: body });
  process.stdout.write(`${name}: HTTP ${response.status}, ${elapsedMs}ms\n`);
}

const output = process.argv[2] ?? "tests/fixtures/search-sql-parity-baseline.json";
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ capturedAt: new Date().toISOString(), endpoint: base, scenarios: entries }, null, 2)}\n`);
process.stdout.write(`Saved ${entries.length} complete response baselines to ${output}\n`);
