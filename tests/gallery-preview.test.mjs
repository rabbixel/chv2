import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildJustifiedRows } from "../components/gallery-preview/justified-layout.mjs";

function product(id, width, height) {
  return { id, images: [{ width, height }] };
}

test("justified gallery rows preserve source aspect ratios and item order", () => {
  const products = [
    product("landscape", 1600, 900),
    product("portrait", 700, 1000),
    product("square", 1000, 1000),
    product("banner", 1800, 600),
  ];
  const rows = buildJustifiedRows(products, 1200, 220, 8);
  const laidOut = rows.flatMap((row) => row.items);

  assert.deepEqual(laidOut.map(({ item }) => item.id), products.map(({ id }) => id));
  for (const row of rows) {
    for (const { item, width } of row.items) {
      const sourceRatio = item.images[0].width / item.images[0].height;
      const expectedRatio = Math.min(2.2, Math.max(0.65, sourceRatio));
      assert.ok(Math.abs(width / row.height - expectedRatio) < 0.001);
    }
  }
});

test("justified gallery bounds complete rows to the available width", () => {
  const products = Array.from({ length: 24 }, (_, index) => product(`p${index}`, 1200, 800));
  const rows = buildJustifiedRows(products, 860, 200, 8);

  assert.ok(rows.length > 1);
  for (const row of rows.slice(0, -1)) {
    const usedWidth = row.items.reduce((sum, entry) => sum + entry.width, 0) + 8 * (row.items.length - 1);
    assert.ok(Math.abs(usedWidth - 860) < 0.01);
  }
});

test("missing image dimensions use a safe default ratio and empty input is stable", () => {
  const rows = buildJustifiedRows([{ id: "unknown", images: [] }], 400, 180);
  assert.equal(rows[0].items[0].width / rows[0].height, 1.25);
  assert.deepEqual(buildJustifiedRows([], 400, 180), []);
  assert.deepEqual(buildJustifiedRows([product("x", 100, 100)], 0, 180), []);
});

test("single ultra-wide images reserve enough height for the corner controls and stay in bounds", () => {
  const rows = buildJustifiedRows([product("panorama", 2400, 600)], 280, 250, 8);
  assert.ok(rows[0].height >= 180);
  assert.ok(rows[0].items[0].width <= 280);
});

test("gallery rows never exceed four images at desktop, tablet, or mobile widths", () => {
  const products = Array.from({ length: 25 }, (_, index) => product(`p${index}`, 1200, 800));
  for (const width of [360, 640, 900, 1440, 2400]) {
    const rows = buildJustifiedRows(products, width, 250, 8);
    assert.ok(rows.every((row) => row.items.length <= 4), `row exceeded four items at ${width}px`);
    for (const row of rows.slice(0, -1)) {
      const rowWidth = row.items.reduce((sum, entry) => sum + entry.width, 0) + 8 * (row.items.length - 1);
      assert.ok(Math.abs(rowWidth - width) < 0.01, `justified row did not fill ${width}px`);
    }
  }
});

test("gallery defaults and overlay controls preserve image-first interactions", async () => {
  const [page, tile, styles] = await Promise.all([
    readFile(new URL("../app/gallery-preview/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/gallery-preview/GalleryPreview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/gallery-preview/GalleryPreview.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /firstValue\(query\.density\) === "compact" \? "compact" : "comfortable"/);
  assert.match(page, /firstValue\(query\.overlay\) === "always" \? "always" : "hover"/);
  assert.match(page, /robots: \{ index: false/);
  assert.doesNotMatch(tile, /infoToggle|Show details/);
  assert.match(tile, /matchMedia\("\(hover: none\) and \(pointer: coarse\)"\)/);
  assert.match(tile, /!product\.isFree/);
  assert.match(tile, /aria-label="View product"/);
  assert.match(styles, /\.title\s*\{[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap/s);
  assert.match(styles, /object-fit: contain/);
});

test("gallery orientation filter is URL-backed and retained through pagination", async () => {
  const [page, filter] = await Promise.all([
    readFile(new URL("../app/gallery-preview/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/gallery-preview/GalleryFilters.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /orientationValue = firstValue\(query\.orientation\)/);
  assert.match(filter, /name="orientation" value=\{option\.value\}/);
  assert.match(filter, /value: "landscape", label: "Landscape"/);
  assert.match(filter, /value: "portrait", label: "Portrait"/);
  assert.match(filter, /value: "square", label: "Square"/);
  assert.match(page, /orientation,\s*\},\s*sort,\s*page,/);
  assert.match(page, /orientation !== "all"\) params\.set\("orientation", orientation\)/);
  assert.match(page, /orientationValue[\s\S]*?: "all"/);
});

test("gallery filters use only server-supported search parameters and sorting", async () => {
  const [page, filters, types, search] = await Promise.all([
    readFile(new URL("../app/gallery-preview/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/gallery-preview/GalleryFilters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/types/search.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/creative-hatti/search.ts", import.meta.url), "utf8"),
  ]);
  assert.match(filters, /name="q"/);
  assert.match(filters, /name="cat"/);
  assert.match(filters, /name="avail"/);
  assert.match(filters, /Choose up to 8 categories/);
  assert.match(filters, /selectedCategories\.length >= 8/);
  assert.match(filters, /name="orientation"/);
  const previewSorts = filters.match(/const sortOptions:[\s\S]*?\n\];/)?.[0] ?? "";
  for (const key of ["relevance", "newest", "best-selling", "price-asc", "price-desc"]) assert.ok(previewSorts.includes(`value: "${key}"`));
  assert.doesNotMatch(previewSorts, /value: "rating"|value: "oldest"/);
  assert.match(page, /categorySlugs: selectedCategories/);
  assert.match(page, /facets\.find\(\(entry\) => entry\.key === "category"\)/);
  assert.match(page, /price: "all" \| "free" \| "paid"/);
  assert.match(types, /orientation\?: ImageOrientation/);
  assert.match(search, /cat: list\(filters\.categorySlugs/);
  assert.match(search, /avail: filters\.availability/);
});

test("gallery filter chips remove only their filter and clear all preserves query and sort", async () => {
  const page = await readFile(new URL("../app/gallery-preview/page.tsx", import.meta.url), "utf8");
  assert.match(page, /categories: selectedCategories\.filter\(\(entry\) => entry !== slug\)/);
  assert.match(page, /price: "all" \}\) \}/);
  assert.match(page, /orientation: "all" \}\) \}/);
  assert.match(page, /query: queryText, category, categories: selectedCategories, price, orientation, sort, density, overlay/);
  assert.match(page, /category: "all", categories: \[\], price: "all", orientation: "all"/);
});

test("filter dialog restores cleanly on history navigation and has mobile sheet layouts", async () => {
  const [filters, css] = await Promise.all([
    readFile(new URL("../components/gallery-preview/GalleryFilters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/gallery-preview/GalleryFilters.module.css", import.meta.url), "utf8"),
  ]);
  assert.match(filters, /window\.addEventListener\("popstate", closeRestoredDialog\)/);
  assert.match(filters, /window\.addEventListener\("pageshow", closeRestoredDialog\)/);
  assert.match(filters, /onChange=\{clearBrowseScopeForPrice\}/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.dialog \{ position: fixed; inset: auto 0 0; width: 100%/);
  assert.match(css, /@media \(max-width: 390px\)[\s\S]*?\.sort \{ grid-column: 1 \/ -1/);
  assert.match(css, /\.dialogBody \{[\s\S]*?overflow-y: auto/);
  assert.doesNotMatch(css, /\.categoryList \{[^}]*overflow-y:/);
});

test("gallery wishlist and cart are stacked at the top while title and eye occupy the bottom", async () => {
  const [tile, styles] = await Promise.all([
    readFile(new URL("../components/gallery-preview/GalleryPreview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/gallery-preview/GalleryPreview.module.css", import.meta.url), "utf8"),
  ]);

  assert.ok(tile.indexOf("className={styles.quickActions}") < tile.indexOf("className={styles.overlay}"));
  assert.match(styles, /\.quickActions\s*\{[^}]*top:[^}]*right:[^}]*flex-direction:\s*column/s);
  assert.match(styles, /\.title\s*\{[^}]*grid-column:\s*1;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap/s);
  assert.match(styles, /\.eyeAction\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1 \/ 3/s);
  assert.match(styles, /\.overlay \.title:link, \.overlay \.title:visited, \.overlay \.title:hover[^}]*color:\s*var\(--ch-color-surface\)/s);
});
