import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/search-facet-options.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { filterOptionsByFacet } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const definitions = ["flyers", "logo-design", "mythological"];
const asValue = (value) => value;

test("empty NFT-like facets hide unrelated category groups", () => {
  const noVectorOptions = filterOptionsByFacet(definitions.slice(0, 2), asValue, [{ value: "nfts", count: 12 }]);
  const noCharacterOptions = filterOptionsByFacet(definitions.slice(2), asValue, [{ value: "nfts", count: 12 }]);
  assert.deepEqual(noVectorOptions, []);
  assert.deepEqual(noCharacterOptions, []);
});

test("only subcategories present in collection-wide facets are offered", () => {
  const visible = filterOptionsByFacet(definitions, asValue, [
    { value: "flyers", count: 8 },
    { value: "mythological", count: 2 },
  ]);
  assert.deepEqual(visible, ["flyers", "mythological"]);
});

test("an active selection remains visible when filtering produces no results", () => {
  const visible = filterOptionsByFacet(definitions, asValue, [], ["logo-design"]);
  assert.deepEqual(visible, ["logo-design"]);
});

test("a matching collection-wide facet stays available even when its current page has no item", () => {
  const currentPageItems = [];
  const visible = filterOptionsByFacet(definitions, asValue, [{ value: "mythological", count: 7 }]);
  assert.equal(currentPageItems.length, 0);
  assert.deepEqual(visible, ["mythological"]);
});

test("shared panel omits complete empty fieldsets, removing dividers and flex gaps", async () => {
  const panel = await readFile(new URL("../components/search/FilterPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /vectorCategories\.length > 0/);
  assert.match(panel, /characterCategories\.length > 0/);
  assert.match(panel, /visibleFileTypes\.length > 0/);
  assert.match(panel, /visibleGroups\.length > 0/);
});
