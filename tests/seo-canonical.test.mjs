import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/seo-canonical.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { canonicalUrlForPath } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const site = "https://shop.example.com";
const path = "/product/ganesh-illustration";

test("keeps an exact Yoast canonical on the storefront origin", () => {
  assert.equal(
    canonicalUrlForPath(`${site}${path}`, site, path),
    `${site}${path}`,
  );
});

test("replaces legacy WordPress, foreign and cross-route canonicals", () => {
  for (const value of [
    "https://wordpress.example.com/downloads/ganesh-illustration/",
    "https://other.example.com/product/ganesh-illustration",
    `${site}/product/a-different-product`,
    `${site}${path}?utm_source=feed`,
    "not a URL",
  ]) {
    assert.equal(canonicalUrlForPath(value, site, path), `${site}${path}`);
  }
});

test("accepts a trailing slash but emits a clean canonical route", () => {
  assert.equal(
    canonicalUrlForPath(`${site}${path}/`, site, path),
    `${site}${path}/`,
  );
});
