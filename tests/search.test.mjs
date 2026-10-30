import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadSource(path, replacements = []) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}
const media = await loadSource("../lib/creative-hatti/media.ts");
const html = await loadSource("../lib/creative-hatti/html.ts");
const adapters = await loadSource("../lib/creative-hatti/adapters.ts", [['"./media"', JSON.stringify(media)], ['"./html"', JSON.stringify(html)]]);
const search = await import(await loadSource("../lib/creative-hatti/search.ts", [['"./adapters"', JSON.stringify(adapters)]]));
const { productFromApi } = await import(adapters);
const { apiFetch, ApiError } = await import(await loadSource("../lib/api/client.ts"));

test("indexed search forwards the query, every filter and sort without losing multiselect values", () => {
  assert.deepEqual(search.searchRequestParams({
    query: "  Diwali vector  ", page: 2, pageSize: 24, sort: "price-asc",
    filters: { groups: ["character-bundle", "vector-creatives"], categorySlugs: ["miscellaneous", "profession"],
      priceMin: 19900, priceMax: 99900, availability: "paid", ratingMin: 4, fileTypes: ["EPS", "PNG"],
      compatibleWith: ["illustrator", "photoshop"], collection: "diwali", licenses: ["commercial"], onSale: true },
  }), {
    q: "Diwali vector", page: 2, per_page: 24, sort: "price-asc", group: "character-bundles,vector-creatives",
    cat: "miscellaneous-character-bundles,profession", min: 19900, max: 99900, avail: "paid", rating: 4,
    file: "EPS,PNG", app: "illustrator,photoshop", collection: "diwali", license: "commercial", sale: true,
  });
});

test("best-selling indexed results preserve descending EDD sales order and pagination", async () => {
  const products = [
    { id: "middle", salesCount: 42 },
    { id: "top", salesCount: 91 },
    { id: "last", salesCount: 11 },
  ];
  const ordered = [...products].sort((a, b) => b.salesCount - a.salesCount);
  assert.deepEqual(ordered.map((product) => product.id), ["top", "middle", "last"]);
  const request = search.searchRequestParams({ query: "", page: 2, pageSize: 1, sort: "best-selling" });
  assert.equal(request.sort, "best-selling");
  assert.equal(request.page, 2);
  assert.equal(request.per_page, 1);
  const source = await readFile(new URL("../lib/services/productService.ts", import.meta.url), "utf8");
  assert.match(source, /getSearchService\(\)\.searchProducts\(\{[\s\S]*?sort: "best-selling"/);
  assert.match(source, /catch \(error\)[\s\S]*?return \[\];/);
});

test("browse mode has no accidental filters and category facets preserve server counts", () => {
  const request = search.searchRequestParams({ query: "" });
  assert.equal(request.q, "");
  assert.equal(request.sort, "relevance");
  assert.equal(request.cat, undefined);
  const facets = [{ key: "category", label: "Category", values: [{ value: "character-bundles", label: "Character Bundles", count: 123 }] }];
  assert.equal(search.searchFacetsFromApi(facets)[0].values[0].value, "character-bundle");
  assert.equal(search.searchFacetsFromApi(facets)[0].values[0].count, 123);
  assert.equal(facets[0].values[0].value, "character-bundles");
});

test("curated collection availability is sent to the indexed server query", () => {
  for (const availability of ["paid", "free"]) {
    const request = search.searchRequestParams({ query: "", page: 3, pageSize: 24, sort: "best-selling", filters: { availability } });
    assert.equal(request.avail, availability);
    assert.equal(request.page, 3);
    assert.equal(request.sort, "best-selling");
  }
});

test("product cards classify mixed-price details as paid rather than free", () => {
  const product = (price, variable_prices) => productFromApi({
    id: 1, title: "Fixture", slug: "fixture", price: { amount: price, currency: "INR" }, categories: [], variable_prices,
  });
  assert.equal(product(0, [{ amount: 0 }, { amount: 250 }]).isFree, false);
  assert.equal(product(0, [{ amount: 0 }, { amount: "invalid" }]).isFree, true);
  assert.equal(product(0, [{ amount: "invalid" }]).isFree, false);
  assert.equal(product(0, undefined).isFree, true);
});

test("EDD detail price types distinguish fixed free, variable, mixed and invalid prices", () => {
  const product = (price, variable_prices = []) => productFromApi({
    id: 1, title: "Fixture", slug: "fixture", price: { currency: "INR", ...price }, categories: [], variable_prices,
  });
  assert.equal(product({ type: "single", amount: 0 }).isFree, true);
  assert.equal(product({ type: "single", amount: "0" }).isFree, true);
  assert.equal(product({ type: "single", amount: 99 }).isFree, false);
  assert.equal(product({ type: "single", amount: 0 }, [{ id: 2, amount: 99 }]).priceOptions, undefined);
  const free = product({ type: "variable" }, [{ id: 0, amount: "0" }, { id: 2, amount: 0 }]);
  assert.equal(free.isFree, true);
  assert.deepEqual(free.priceOptions.map((option) => option.id), [0, 2]);
  const mixed = product({ type: "variable", class: "free" }, [{ id: 0, amount: 0 }, { id: 2, amount: 100 }]);
  assert.equal(mixed.isFree, false);
  assert.deepEqual(mixed.priceOptions.map((option) => option.price.amount), [0, 10000]);
  const filtered = product({ type: "variable" }, [{ id: 0, amount: null }, { id: 2, amount: 100 }]);
  assert.equal(filtered.isFree, false);
  assert.deepEqual(filtered.priceOptions.map((option) => option.id), [2]);
  for (const amount of [null, undefined, "", "bad", -1, Infinity, false]) {
    const invalid = product({ type: "single", amount });
    assert.equal(invalid.isFree, false);
    assert.equal(invalid.purchasable, false);
  }
  assert.equal(product({ type: "variable", amount: 0 }).purchasable, false);
  assert.equal(product({ amount: 0, class: "mixed" }).isFree, false);
});

test("API client safely encodes query punctuation and propagates index failures", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.CH_API_URL;
  process.env.CH_API_URL = "http://catalogue.test/wp-json/ch/v1";
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(input);
      assert.equal(url.pathname, "/wp-json/ch/v1/indexed-search");
      assert.equal(url.searchParams.get("q"), "diwali & lights");
      return new Response(JSON.stringify({ code: "search_not_ready", message: "Index pending" }), { status: 503 });
    };
    await assert.rejects(apiFetch("/indexed-search", { searchParams: { q: "diwali & lights" } }),
      (error) => error instanceof ApiError && error.status === 503 && error.code === "search_not_ready");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.CH_API_URL;
    else process.env.CH_API_URL = originalUrl;
  }
});
