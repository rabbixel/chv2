const endpoint = process.env.SEARCH_TEST_API_URL ?? "http://creativehatti.test/wp-json/ch/v1/indexed-search";
if (!new Set(["creativehatti.test", "localhost", "127.0.0.1"]).has(new URL(endpoint).hostname)) {
  throw new Error("Search benchmark is restricted to a local WordPress endpoint.");
}
const samples = Math.max(1, Math.min(5, Number(process.argv[2] ?? 3)));
const url = new URL(endpoint);
url.searchParams.set("q", "vector");
url.searchParams.set("per_page", "24");
url.searchParams.set("sort", "relevance");
const timings = [];
for (let i = 0; i < samples; i += 1) {
  const started = performance.now();
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json();
  const httpMs = Math.round(performance.now() - started);
  if (!response.ok || !body.success) throw new Error(`Search failed: HTTP ${response.status}`);
  timings.push({ httpMs, handlerMs: body.took_ms, total: body.pagination.total });
  process.stdout.write(`sample ${i + 1}: HTTP ${httpMs}ms; handler ${body.took_ms}ms; total ${body.pagination.total}\n`);
}
const median = (key) => [...timings].map((item) => item[key]).sort((a, b) => a - b)[Math.floor(timings.length / 2)];
process.stdout.write(`median HTTP ${median("httpMs")}ms; handler ${median("handlerMs")}ms\n`);
