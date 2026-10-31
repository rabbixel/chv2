import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadSearchParams() {
  const source = await readFile(new URL("../lib/search-params.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

test("search URL parser and builder preserve legacy filters and gallery state", async () => {
  const { parseListingParams, buildListingHref } = await loadSearchParams();
  const listing = parseListingParams({
    q: "diwali lights", sort: "best-selling", group: ["vector-creatives"],
    cat: ["social-media", "flyers"], min: "100", max: "900", avail: "paid",
    file: ["EPS", "PNG"], app: ["illustrator"], collection: "diwali",
    orientation: "landscape", density: "compact", overlay: "always", page: "3",
  });

  assert.deepEqual(listing, {
    q: "diwali lights", sort: "best-selling", groups: ["vector-creatives"],
    cats: ["social-media", "flyers"], min: 100, max: 900, avail: "paid",
    files: ["EPS", "PNG"], apps: ["illustrator"], collection: "diwali",
    orientation: "landscape", density: "compact", overlay: "always", page: 3,
  });
  const href = buildListingHref("/search", listing);
  const parsed = new URL(href, "https://creativehatti.test");
  for (const key of ["q", "sort", "group", "cat", "min", "max", "avail", "file", "app", "collection", "orientation", "density", "overlay", "page"]) {
    assert.ok(parsed.searchParams.has(key), `missing preserved ${key} parameter`);
  }
});

test("default search page uses the shared image-first gallery and retains search metadata", async () => {
  const [page, filters, gallery] = await Promise.all([
    readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/gallery-preview/GalleryFilters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/gallery-preview/GalleryPreview.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<GalleryPreview products=\{items\}/);
  assert.match(page, /mode="search"/);
  assert.match(page, /robots: \{ index: false, follow: true \}/);
  assert.match(page, /getSearchService\(\)\.searchProducts/);
  assert.match(page, /returnTo=\{buildListingHref\(routes\.search\(\), listing\)\}/);
  for (const field of ['name="q"', 'name="group"', 'name="cat"', 'name="avail"', 'name="orientation"', 'name="min"', 'name="max"', 'name="file"', 'name="app"', 'name="collection"']) {
    assert.ok(filters.includes(field), `missing search control ${field}`);
  }
  assert.match(gallery, /returnTo\s*\?\?\s*routes\.galleryPreview\(\)/);
});

test("search toolbar has one bordered control and a single focus-within ring", async () => {
  const css = await readFile(new URL("../components/gallery-preview/GalleryFilters.module.css", import.meta.url), "utf8");
  assert.match(css, /\.toolbar\s*\{[^}]*margin-bottom/s);
  assert.match(css, /\.search\s*\{[^}]*border:\s*1px/s);
  assert.match(css, /\.search:focus-within\s*\{[^}]*outline\s*:/s);
  assert.match(css, /\.searchInput:focus, \.searchInput:focus-visible\s*\{[^}]*outline:\s*0/);
  assert.match(css, /\.searchInput::-webkit-search-cancel-button/);
  assert.match(css, /\.clearSearch/);
});

test("header and homepage hero search submit through the same URL-backed search route", async () => {
  const [searchBar, header, hero] = await Promise.all([
    readFile(new URL("../components/search/SearchBar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/layout/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/home/Hero.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(searchBar, /router\.push\(routes\.search\(trimmed\)\)/);
  assert.match(header, /<SearchBar/);
  assert.match(hero, /<SearchBar/);
});

test("shared search suggestions override inherited alignment and keep rows compact", async () => {
  const css = await readFile(new URL("../components/search/SearchBar.module.css", import.meta.url), "utf8");
  assert.match(css, /\.panel\s*\{[^}]*text-align:\s*left/s);
  assert.match(css, /\.list\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.sectionTitle\s*\{[^}]*justify-content:\s*space-between/s);
  assert.match(css, /\.option\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*text-align:\s*left/s);
  assert.match(css, /\.optionLabel\s*\{[^}]*flex:\s*1[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.panel\s*\{[^}]*left:\s*0[^}]*right:\s*0/s);
});
