import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [homepage, hero, popularSearches, footer, globals, tokens, discoveryGrid, categories, packs] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/home/Hero.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/home/PopularSearches.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/layout/SiteFooter.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../styles/tokens.css", import.meta.url), "utf8"),
  readFile(new URL("../components/home/DiscoveryGrid.module.css", import.meta.url), "utf8"),
  readFile(new URL("../components/home/CharacterCategories.module.css", import.meta.url), "utf8"),
  readFile(new URL("../components/home/FeaturedPacks.module.css", import.meta.url), "utf8"),
]);

test("homepage sections, Hero, Popular Searches, and footer reuse the wide container", () => {
  assert.equal((homepage.match(/<Container size="wide">/g) ?? []).length, 6);
  assert.match(hero, /className="ch-container ch-container--wide"/);
  assert.match(popularSearches, /className="ch-container ch-container--wide"/);
  assert.equal((footer.match(/ch-container ch-container--wide/g) ?? []).length, 2);
  assert.match(globals, /\.ch-container--wide\s*\{\s*max-width:\s*var\(--ch-container-xl\)/);
  assert.match(tokens, /--ch-container-xl:\s*1360px/);
});

test("wider section wrappers preserve existing homepage grid counts", () => {
  assert.match(discoveryGrid, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(categories, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(packs, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(homepage, /<PopularFreebies products=\{popularFreeCharacters\}/);
});
