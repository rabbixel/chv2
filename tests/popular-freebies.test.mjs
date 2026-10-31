import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const homepage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const service = await readFile(new URL("../lib/services/productService.ts", import.meta.url), "utf8");
const component = await readFile(new URL("../components/home/PopularFreebies.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../components/home/PopularFreebies.module.css", import.meta.url), "utf8");
const selection = await readFile(new URL("../lib/creative-hatti/popular-free-characters.mjs", import.meta.url), "utf8");
const { selectPopularFreeCharacters } = await import("../lib/creative-hatti/popular-free-characters.mjs");
const { popularFreebieArtwork } = await import("../lib/creative-hatti/popular-freebies-artwork.mjs");

test("homepage inserts the data-backed gallery between character categories and featured packs", () => {
  const categories = homepage.indexOf("<CharacterCategories");
  const freebies = homepage.indexOf("<PopularFreebies");
  const packs = homepage.indexOf("<FeaturedPacks");
  assert.ok(categories >= 0 && categories < freebies && freebies < packs);
  assert.match(homepage, /listPopularFreeCharacters\(8\)/);
  assert.match(homepage, /productSelections\.popularFreebies\.mode === "manual"/);
  assert.match(homepage, /productSelections\.hattiChoice\.mode === "manual"/);
  assert.match(service, /async getProductsByIds\(ids: string\[\]\)/);
  assert.match(service, /return refreshed\.filter\(\(product\) => product\.status === "active"\)/);
});

test("service requests only free character bundles in indexed best-selling order", () => {
  const searchMethod = service.match(/async function searchPopularFreeCharacters[\s\S]*?\n}\n/)?.[0] ?? "";
  assert.match(service, /groups:\s*\["freebies"\]/);
  assert.match(service, /availability:\s*"free"/);
  assert.match(service, /sort:\s*"best-selling"/);
  assert.match(service, /pageSize:\s*POPULAR_FREE_CHARACTER_CANDIDATE_LIMIT/);
  assert.match(service, /selectPopularFreeCharacters\(result\.items, safeLimit\)/);
  assert.match(selection, /seen\.has\(key\)/);
  assert.match(service, /catch \(error\)[\s\S]*?return \[\];/);
  assert.doesNotMatch(searchMethod, /sort:\s*"newest"/);
});

test("selection preserves indexed order and excludes non-character, inactive, duplicate or imageless products", () => {
  const product = (overrides = {}) => ({
    id: "1", status: "active", productGroup: "freebies", kind: "freebie",
    slug: "character-portrait", title: "Free vector portrait illustration", keywords: [],
    categorySlugs: ["freebies"], images: [{ url: "https://media.test/portrait.png" }],
    ...overrides,
  });
  const selected = selectPopularFreeCharacters([
    product({ id: "popular", slug: "first", title: "First free portrait" }),
    product({ id: "general", slug: "general", title: "Free pattern pack" }),
    product({ id: "inactive", slug: "inactive", status: "draft" }),
    product({ id: "image-less", slug: "image-less", images: [{ url: "" }] }),
    product({ id: "popular", slug: "duplicate", title: "Duplicate portrait" }),
    product({ id: "category", slug: "category", title: "Character art", categorySlugs: ["freebies", "actors"] }),
  ], 8);
  assert.deepEqual(selected.map((item) => item.id), ["popular", "category"]);
  assert.deepEqual(selectPopularFreeCharacters(selected, 1).map((item) => item.id), ["popular"]);
  assert.deepEqual(selectPopularFreeCharacters(selected, 0), []);
});

test("gallery is artwork-only, limited to eight, and links to valid product routes", () => {
  assert.match(component, /products\.slice\(0, 8\)/);
  assert.match(component, /routes\.product\(product\.slug\)/);
  assert.match(component, /alt=\{image\.alt\.trim\(\) \|\|/);
  assert.match(component, /aria-label=\{`View free character illustration:/);
  assert.match(component, /unoptimized=\{process\.env\.NODE_ENV !== "production" && isLocalWordPressMediaUrl\(image\.url\)\}/);
  assert.doesNotMatch(component, /Add to cart|wishlist|formatMoney|price\.amount/);
  assert.match(component, /if \(items\.length === 0\) return null/);
});

test("automatic card images and manual detail galleries use the same primary thumbnail contract", () => {
  const thumbnail = { url: "https://media.test/card-thumb.jpg", width: 300, height: 300 };
  const fullGallery = { url: "https://media.test/full-gallery.jpg", width: 1600, height: 1200 };
  assert.equal(popularFreebieArtwork([thumbnail]), thumbnail);
  assert.equal(popularFreebieArtwork([thumbnail, fullGallery]), thumbnail);
  assert.equal(popularFreebieArtwork([{ url: " " }, fullGallery]), fullGallery);
  assert.match(component, /popularFreebieArtwork\(product\.images\)/);
  assert.doesNotMatch(component, /bestArtwork|width \?\? 0\).*height/);
  assert.match(homepage, /productSelections\.popularFreebies\.mode === "manual"[\s\S]*?: products\.listPopularFreeCharacters\(8\)/);
  assert.match(homepage, /<PopularFreebies products=\{popularFreeCharacters\}/);
});

test("gallery supports an eight-item desktop row, touch-scroll tablet/mobile rails and reduced motion", () => {
  assert.match(styles, /grid-template-columns:\s*repeat\(var\(--gallery-count\),\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /@media \(max-width: 1023px\)[\s\S]*?grid-auto-flow:\s*column/);
  assert.match(styles, /grid-auto-columns:[^;]*\/ 4/);
  assert.match(styles, /@media \(max-width: 639px\)[\s\S]*?grid-auto-columns:[^;]*\/ 2\.5/);
  assert.match(styles, /overflow-x:\s*auto/);
  assert.match(styles, /scroll-snap-type:\s*x mandatory/);
  assert.match(styles, /\.artwork\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s);
  assert.doesNotMatch(styles, /background:\s*var\(--ch-color-brand-soft\)/);
  assert.doesNotMatch(styles, /padding-block:\s*var\(--ch-space-1\)/);
  assert.match(styles, /object-fit:\s*contain/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(component, /tabIndex=\{0\}/);
});
