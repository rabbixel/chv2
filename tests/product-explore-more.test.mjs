import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { selectRelatedCategories, selectRelatedCollections } from "../lib/creative-hatti/related-explore.mjs";

const product = {
  slug: "diwali-lantern-vector",
  title: "Diwali Lantern Vector Illustration",
  productGroup: "vector-creatives",
  categorySlugs: ["diwali", "festival-graphics", "retired-category", "diwali"],
  tags: ["lantern", "festival"],
  keywords: ["Diwali", "lights"],
};

test("collection matching preserves exact all-token relevance and removes invalid, duplicate and self entries", () => {
  const matches = selectRelatedCollections(product, [
    { slug: product.slug, query: "Diwali Lantern" },
    { slug: "diwali", query: "Diwali Lantern" },
    { slug: "diwali-lights", query: "Diwali Lights" },
    { slug: "festival-vector", query: "Vector Festival" },
    { slug: "broad", query: "Festival Logos" },
    { slug: "empty", query: "  " },
    { slug: "diwali", query: "Diwali Lantern" },
  ], 4, [product.slug]);

  assert.deepEqual(matches.map(({ slug }) => slug), ["diwali", "diwali-lights", "festival-vector"]);
});

test("related category links are limited to accessible API categories, unique, ordered and self-excluded", () => {
  const available = [
    { slug: "festival-graphics", name: "Festival Graphics" },
    { slug: "diwali", name: "Diwali" },
    { slug: "other", name: "Other" },
  ];
  const matches = selectRelatedCategories(product.categorySlugs, available, 6, [product.slug]);
  assert.deepEqual(matches.map(({ slug }) => slug), ["diwali", "festival-graphics"]);
});

test("product page renders one conditional Explore More section using WordPress directory entries and responsive artwork", async () => {
  const [page, styles, directory] = await Promise.all([
    readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/product/[slug]/page.module.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/services/collectionDirectoryService.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /getCollectionDirectoryService\(\)[\s\S]*?getEntriesBySlugs/);
  assert.match(page, /relatedCollectionEntries\.length > 0 \|\| relatedCategories\.length > 0/);
  assert.match(page, /<h2 id="explore-more-heading"[^>]*>Explore More<\/h2>/);
  assert.match(page, /collection\.image\?\.url/);
  assert.match(page, /<ProductImage[\s\S]*?decorative/);
  assert.match(page, /collection\.href \?\? routes\.collection/);
  assert.match(directory, /getEntriesBySlugs\(slugs: readonly string\[\]\)/);
  assert.ok(directory.includes('slugs.filter((slug) => /^[\\w-]+$/.test(slug))'));
  assert.match(directory, /\.slice\(0, 4\)/);
  assert.match(directory, /this\.image\(card\.mediaId\)/);
  assert.match(styles, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /object-fit:\s*contain/);
  assert.match(styles, /@media \(max-width:\s*1023px\)/);
  assert.match(styles, /@media \(max-width:\s*380px\)/);
});
