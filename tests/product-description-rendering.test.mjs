import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [adapter, transformer, page, styles] = await Promise.all([
  readFile(new URL("../lib/creative-hatti/adapters.ts", import.meta.url), "utf8"),
  readFile(new URL("../wordpress/creative-hatti-api/includes/class-ch-product-transformer.php", import.meta.url), "utf8"),
  readFile(new URL("../app/product/[slug]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/product/[slug]/page.module.css", import.meta.url), "utf8"),
]);

test("product descriptions preserve WordPress-sanitized rich HTML", () => {
  assert.match(transformer, /wp_kses_post\( do_blocks\( \$content \) \)/);
  assert.match(adapter, /description: detail\.description\?\.trim\(\) \|\| undefined/);
  assert.doesNotMatch(adapter, /description: stripHtml\(detail\.description\)/);
  assert.match(page, /dangerouslySetInnerHTML=\{\{ __html: product\.description \}\}/);
  assert.doesNotMatch(page, /<p className=\{styles\.description\}>\{product\.description\}<\/p>/);
});

test("rich product descriptions have readable heading, paragraph and list styling", () => {
  assert.match(styles, /\.description h2/);
  assert.match(styles, /\.description p/);
  assert.match(styles, /\.description ul,/);
  assert.match(styles, /\.description li::marker/);
});
