import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/homepage-config.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { resolveHomepageHero } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("legacy response and no overrides retain the current Hero defaults", () => {
  const hero = resolveHomepageHero();
  assert.equal(hero.enabled, true);
  assert.equal(hero.heading, "The Ultimate Collection of Indian Vector Assets");
  assert.equal(hero.searchButtonText, "Search");
  assert.equal(hero.stats.length, 3);
  assert.ok(hero.images.every((item) => item.mode === "default"));
});

test("a single field override leaves all other defaults intact", () => {
  const hero = resolveHomepageHero({ heading: { mode: "custom", value: "A new title" } });
  assert.equal(hero.heading, "A new title");
  assert.equal(hero.eyebrow, "India's creative marketplace");
  assert.equal(hero.description.includes("authentic Indian tadka"), true);
});

test("explicit empty values, cleared image slots and disabled sections do not fall back", () => {
  const hero = resolveHomepageHero({
    enabled: { mode: "custom", value: false },
    heading: { mode: "custom", value: "" },
    images: [{ mode: "custom", image: null }],
  });
  assert.equal(hero.enabled, false);
  assert.equal(hero.heading, "");
  assert.deepEqual(hero.images[0], { mode: "custom", image: null, href: undefined });
  assert.equal(hero.images[1].mode, "default");
});

test("custom image and statistic visibility apply independently", () => {
  const image = { url: "https://media.example.test/hero.png" };
  const hero = resolveHomepageHero({
    images: [{ mode: "custom", image, link_url: "/collections/diwali" }],
    stats: [{ mode: "custom", value: "Editors", label: "Choice", visible: false }],
  });
  assert.deepEqual(hero.images[0], { mode: "custom", image, href: "/collections/diwali" });
  assert.deepEqual(hero.stats[0], { value: "Editors", label: "Choice", visible: false });
  assert.deepEqual(hero.stats[1], { value: "100+", label: "Festival collections", visible: true });
});
