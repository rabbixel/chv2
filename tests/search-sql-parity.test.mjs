import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const endpoint = process.env.SEARCH_TEST_API_URL ?? "http://creativehatti.test/wp-json/ch/v1/indexed-search";
const enabled = process.env.RUN_SEARCH_SQL_PARITY === "1";

test("indexed search responses exactly match the captured SQL parity baseline", { skip: !enabled }, async () => {
  const fixture = JSON.parse(await readFile(new URL("./fixtures/search-sql-parity-baseline.json", import.meta.url), "utf8"));
  assert.equal(new URL(endpoint).host, "creativehatti.test", "parity suite is restricted to the local WordPress host");
  for (const scenario of fixture.scenarios) {
    const url = new URL(endpoint);
    for (const [key, value] of Object.entries(scenario.params)) url.searchParams.set(key, value);
    const response = await fetch(url, { cache: "no-store" });
    let body = await response.json();
    if (body && typeof body === "object") delete body.took_ms;
    assert.equal(response.status, scenario.status, `${scenario.name}: HTTP status`);
    assert.deepEqual(body, scenario.response, `${scenario.name}: observable response changed`);
  }
});
