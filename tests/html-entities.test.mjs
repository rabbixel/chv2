import assert from "node:assert/strict";
import test from "node:test";
import { decodeHtmlEntities } from "../lib/creative-hatti/html.ts";

test("decodes WordPress numeric and common named entities into plain text", () => {
  assert.equal(
    decodeHtmlEntities("Patient&#8217;s Teeth &amp; Bunta &#8211; &quot;Chef&#039;s&quot; &nbsp;"),
    "Patient’s Teeth & Bunta – \"Chef's\" \u00a0",
  );
  assert.equal(decodeHtmlEntities("Caf&eacute; &copy;"), "Café ©");
});

test("decodes one layer and preserves unknown or markup-looking text", () => {
  assert.equal(decodeHtmlEntities("&amp;#8217;"), "&#8217;");
  assert.equal(decodeHtmlEntities("&madeup; &lt;script&gt;"), "&madeup; <script>");
});
