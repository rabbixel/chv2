import test from "node:test";
import assert from "node:assert/strict";
import { decodeHtmlEntities } from "../lib/creative-hatti/html.ts";

test("decodes common decimal, hexadecimal, and named entities in API titles", () => {
  assert.equal(
    decodeHtmlEntities("Raju&#8217;s &amp; &#x1F3A8; &#039;Design&#039;"),
    "Raju’s & 🎨 'Design'",
  );
});

test("keeps malformed entities as inert text", () => {
  assert.equal(decodeHtmlEntities("Broken &#xZZ; &unknown;"), "Broken &#xZZ; &unknown;");
});
