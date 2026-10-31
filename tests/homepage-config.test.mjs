import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/homepage-config.ts", import.meta.url), "utf8");
const heroComponent = await readFile(new URL("../components/home/Hero.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { resolveHomepageHero } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const routesSource = await readFile(new URL("../lib/routes.ts", import.meta.url), "utf8");
const { outputText: routesOutput } = ts.transpileModule(routesSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { routes } = await import(`data:text/javascript;base64,${Buffer.from(routesOutput).toString("base64")}`);

test("legacy response and no overrides retain the current Hero defaults", () => {
  const hero = resolveHomepageHero();
  assert.equal(hero.enabled, true);
  assert.equal(hero.showImages, true);
  assert.equal(hero.heading, "The Ultimate Collection of Indian Vector Assets");
  assert.equal(hero.searchButtonText, "Search");
  assert.equal(hero.stats.length, 3);
  assert.deepEqual(hero.stats.map(({ value, label }) => [value, label]), [
    ["44,000+", "Ready-to-use assets"],
    ["470+", "Freebies"],
    ["926+", "Bundles"],
  ]);
  assert.ok(hero.images.every((item) => item.mode === "default" && item.destinationType === "default_product"));
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
  assert.equal(hero.showImages, true);
  assert.equal(hero.heading, "");
  assert.deepEqual(hero.images[0], { mode: "custom", image: null, destinationType: "default_product", searchKeyword: "", href: undefined });
  assert.equal(hero.images[1].mode, "default");
});

test("Hero product images default to visible and can be hidden without clearing image selections", () => {
  const enabled = resolveHomepageHero({ images: [{ mode: "custom", image: { url: "/hero.jpg" } }] });
  assert.equal(enabled.showImages, true);
  assert.deepEqual(enabled.images[0], { mode: "custom", image: { url: "/hero.jpg" }, destinationType: "default_product", searchKeyword: "", href: undefined });

  const hidden = resolveHomepageHero({
    show_images: { mode: "custom", value: false },
    images: [{ mode: "custom", image: { url: "/hero.jpg" } }],
  });
  assert.equal(hidden.showImages, false);
  assert.deepEqual(hidden.images[0], { mode: "custom", image: { url: "/hero.jpg" }, destinationType: "default_product", searchKeyword: "", href: undefined });

  const restored = resolveHomepageHero({ show_images: { mode: "custom", value: true } });
  assert.equal(restored.showImages, true);
});

test("legacy custom image links retain their custom URL precedence", () => {
  const image = { url: "https://media.example.test/hero.png" };
  const hero = resolveHomepageHero({
    images: [{ mode: "custom", image, link_url: "/collections/diwali" }],
  });
  assert.deepEqual(hero.images[0], { mode: "custom", image, destinationType: "custom_url", searchKeyword: "", href: "/collections/diwali" });
});

test("Hero destination types preserve independent values and encode search keywords", () => {
  const hero = resolveHomepageHero({
    images: [
      { destination_type: "default_product" },
      { mode: "custom", image: { url: "/custom.png" }, destination_type: "search", search_keyword: "Diwali lights & रंगोली" },
      { destination_type: "search", search_keyword: "Goa beach" },
      { destination_type: "custom_url", link_url: "https://creativehatti.com/custom-path" },
    ],
  });
  assert.equal(hero.images[0].destinationType, "default_product");
  assert.equal(hero.images[1].mode, "custom");
  assert.equal(hero.images[1].destinationType, "search");
  assert.equal(hero.images[1].searchKeyword, "Diwali lights & रंगोली");
  assert.equal(routes.search(hero.images[1].searchKeyword), "/search?q=Diwali%20lights%20%26%20%E0%A4%B0%E0%A4%82%E0%A4%97%E0%A5%8B%E0%A4%B2%E0%A5%80");
  assert.equal(hero.images[3].href, "https://creativehatti.com/custom-path");
});

test("custom image sources remain independent from default-product and custom-URL destinations", () => {
  const image = { url: "/selected-media-library-image.jpg" };
  const defaultProduct = resolveHomepageHero({
    images: [{ mode: "custom", image, destination_type: "default_product" }],
  }).images[0];
  assert.equal(defaultProduct.mode, "custom");
  assert.equal(defaultProduct.image, image);
  assert.equal(defaultProduct.destinationType, "default_product");

  const customUrl = resolveHomepageHero({
    images: [{ mode: "custom", image, destination_type: "custom_url", link_url: "/campaign/landing" }],
  }).images[0];
  assert.equal(customUrl.image, image);
  assert.equal(customUrl.destinationType, "custom_url");
  assert.equal(customUrl.href, "/campaign/landing");
});

test("Hero applies each WordPress destination type while retaining default product links", () => {
  assert.match(heroComponent, /slot\.destinationType === "search"/);
  assert.match(heroComponent, /routes\.search\(slot\.searchKeyword\)/);
  assert.match(heroComponent, /slot\.destinationType === "custom_url"/);
  assert.match(heroComponent, /routes\.product\(product\.slug\)/);
  assert.match(heroComponent, /config\.showImages \? config\.images\.flatMap/);
});

test("custom image and statistic visibility apply independently", () => {
  const hero = resolveHomepageHero({
    images: [{ mode: "custom", image: { url: "/hero.png" }, destination_type: "search", search_keyword: "Diwali" }],
    stats: [{ mode: "custom", value: "Editors", label: "Choice", visible: false }],
  });
  assert.deepEqual(hero.stats[0], { value: "Editors", label: "Choice", visible: false });
  assert.deepEqual(hero.stats[1], { value: "470+", label: "Freebies", visible: true });
});
