import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/creative-hatti/collections.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { parseCollectionCards, collectionGridQuery } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("reads WordPress card order, attachment IDs and editorial counts", () => {
  const content = `[vc_single_image image=&#8221;104187&#8243; link=&#8221;https://example.com/vector-creatives/monsoon-creatives/&#8221;][vc_column_text]<a href="https://example.com/">Monsoon &amp; rain</a><span class="bendown">75+ Items</span>[/vc_column_text]
    [vc_single_image image="95858" link="https://example.com/mothers-day/"]<a>Mother&#8217;s Day</a><span class="bendown">35+ Items</span>`;
  assert.deepEqual(parseCollectionCards(content), [
    { slug: "monsoon-creatives", title: "Monsoon & rain", mediaId: 104187, countLabel: "75+ Items" },
    { slug: "mothers-day", title: "Mother’s Day", mediaId: 95858, countLabel: "35+ Items" },
  ]);
});
test("does not turn malformed links or missing attachments into cards", () => {
  assert.deepEqual(parseCollectionCards('[vc_single_image image="abc" link="javascript:alert(1)"]<a>Invalid</a>'), []);
  assert.deepEqual(parseCollectionCards(""), []);
});
test("extracts the legacy grid query without executing shortcodes", () => {
  assert.equal(collectionGridQuery('[grid_plus name=&#8221;Nurses Day&#8221;]'), "Nurses Day");
  assert.equal(collectionGridQuery("<p>No grid</p>"), undefined);
});
