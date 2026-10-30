import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const mediaSource = await readFile(new URL("../lib/creative-hatti/media.ts", import.meta.url), "utf8");
const { outputText: mediaOutput } = ts.transpileModule(mediaSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const mediaModule = `data:text/javascript;base64,${Buffer.from(mediaOutput).toString("base64")}`;
const source = (await readFile(new URL("../lib/creative-hatti/clients.ts", import.meta.url), "utf8"))
  .replace('from "@/lib/creative-hatti/media"', `from "${mediaModule}"`);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { selectFeaturedClientBrands } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("homepage featured client logos use the supplied eight-image order", () => {
  const brands = [
    { id: "a", name: "KhataBook", image: { url: "/khata.png" } },
    { id: "b", name: "meesho", image: { url: "/meesho.png" } },
    { id: "c", name: "FlipKart", image: { url: "/flipkart.png" } },
    { id: "d", name: "IshaFoundation", image: { url: "/isha.png" } },
    { id: "e", name: "MyGov", image: { url: "/mygov.png" } },
    { id: "f", name: "PayTM", image: { url: "/paytm-original.png" } },
    { id: "g", name: "InDriver", image: { url: "/indriver-original.png" } },
    { id: "h", name: "Other existing client", image: { url: "/other.png" } },
  ];

  const featured = selectFeaturedClientBrands(brands);
  assert.deepEqual(featured.map((brand) => brand.name), [
    "Amazon India", "Flipkart", "Paytm", "myGov", "HT", "InDriver", "KhataBook", "Meesho",
  ]);
  assert.equal(featured.length, 8);
  assert.deepEqual(featured.map((brand) => brand.colorImageUrl), [
    undefined, "/flipkart.png", "/paytm-original.png", "/mygov.png",
    undefined, "/indriver-original.png", "/khata.png", "/meesho.png",
  ]);
  assert.deepEqual(featured.map((brand) => new URL(brand.image.url).pathname), [
    "/wp-content/uploads/2021/08/Amazon-India.png",
    "/wp-content/uploads/2021/07/Flipkart-1.png",
    "/wp-content/uploads/2021/07/Paytm-Blue-2.png",
    "/wp-content/uploads/2021/07/MyGOv-1.png",
    "/wp-content/uploads/2021/07/HT-1.png",
    "/wp-content/uploads/2021/07/InDriver-1.png",
    "/wp-content/uploads/2021/07/Khata-Book-1.png",
    "/wp-content/uploads/2021/07/Meesho-1.png",
  ]);
});

test("featured logos do not disappear when their color logo is missing from WordPress homepage data", () => {
  const featured = selectFeaturedClientBrands([
    { id: "a", name: "PayTM", image: { url: "/paytm.png" } },
  ]);
  assert.equal(featured.length, 8);
  assert.deepEqual(featured.map((brand) => brand.name), [
    "Amazon India", "Flipkart", "Paytm", "myGov", "HT", "InDriver", "KhataBook", "Meesho",
  ]);
  assert.equal(featured[2].colorImageUrl, "/paytm.png");
});

test("homepage featured logos stay in a single eight-column desktop row", async () => {
  const css = await readFile(new URL("../components/clients/ClientLogoGrid.module.css", import.meta.url), "utf8");
  assert.match(css, /@media \(min-width: 1024px\)\s*\{\s*\.featured\s*\{\s*grid-template-columns:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
});
