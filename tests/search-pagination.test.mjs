import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getPaginationWindow } from "../components/gallery-preview/pagination-window.mjs";

test("pagination window includes all pages for small result sets", () => {
  assert.deepEqual(getPaginationWindow(1, 5), [
    { type: "page", page: 1 }, { type: "page", page: 2 }, { type: "page", page: 3 },
    { type: "page", page: 4 }, { type: "page", page: 5 },
  ]);
});

test("pagination window adds leading, middle and trailing ellipses correctly", () => {
  const first = getPaginationWindow(1, 31);
  assert.deepEqual(first.slice(0, 5).map((item) => item.type === "page" ? item.page : item.key), [1, 2, 3, 4, 5]);
  assert.equal(first.at(-2).type, "ellipsis");
  assert.equal(first.at(-1).page, 31);

  const middle = getPaginationWindow(16, 31);
  assert.equal(middle[1].type, "ellipsis");
  assert.deepEqual(middle.slice(2, 5).map((item) => item.page), [15, 16, 17]);
  assert.equal(middle[5].type, "ellipsis");

  const last = getPaginationWindow(31, 31);
  assert.equal(last[0].page, 1);
  assert.equal(last[1].type, "ellipsis");
  assert.deepEqual(last.slice(-5).map((item) => item.page), [27, 28, 29, 30, 31]);
});

test("pagination clamps invalid page positions and mobile window stays compact", () => {
  assert.deepEqual(getPaginationWindow(0, 4).map((item) => item.page), [1, 2, 3, 4]);
  assert.deepEqual(getPaginationWindow(10, 4).map((item) => item.page), [1, 2, 3, 4]);
  assert.ok(getPaginationWindow(50, 100, 0).length < getPaginationWindow(50, 100, 1).length);
});

test("shared pagination preserves route state, accessible states and reduced-motion scrolling", async () => {
  const [component, css, searchPage, previewPage, params] = await Promise.all([
    readFile(new URL("../components/gallery-preview/SearchPagination.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/gallery-preview/SearchPagination.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/gallery-preview/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/search-params.ts", import.meta.url), "utf8"),
  ]);

  assert.match(component, /aria-current="page"/);
  assert.match(component, /type="button" disabled aria-label=/);
  assert.match(component, /aria-label=\{labels\[kind\]\}/);
  assert.match(component, /prefers-reduced-motion:\s*reduce/);
  assert.match(component, /scrollIntoView/);
  assert.match(component, /scroll=\{false\}/);
  assert.match(component, /hrefBase:\s*string/);
  assert.match(component, /page=\$\{page\}/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\.mobilePages \{ display: flex; \}/);
  assert.match(css, /min-height:\s*2\.75rem/);
  assert.match(searchPage, /<SearchPagination/);
  assert.match(searchPage, /hrefBase=\{buildListingHref\(routes\.search\(\), withListingPatch\(listing, \{ page: 1 \}\)\)\}/);
  assert.doesNotMatch(searchPage, /hrefForPage=\{/);
  assert.match(searchPage, /listing\.page > result\.pagination\.totalPages/);
  assert.match(searchPage, /id="search-results"/);
  assert.match(previewPage, /<SearchPagination/);
  assert.match(previewPage, /hrefBase=\{galleryHref\(currentHref\)\}/);
  assert.doesNotMatch(previewPage, /hrefForPage=\{/);
  assert.match(previewPage, /page > pagination\.totalPages/);
  assert.match(params, /orientation && params\.orientation !== "all"/);
});

test("live Next search responses render results without the pagination RSC serialization error", {
  skip: !process.env.SEARCH_TEST_FRONTEND_URL,
}, async () => {
  const base = process.env.SEARCH_TEST_FRONTEND_URL.replace(/\/$/, "");
  for (const term of ["diwali", "character", "goa"]) {
    const response = await fetch(`${base}/search?q=${encodeURIComponent(term)}`);
    const html = await response.text();
    assert.equal(response.status, 200, `${term} search status`);
    assert.match(html, /Showing <!-- -->\d+<!-- --> of <!-- -->\d+<!-- --> products/);
    assert.doesNotMatch(html, /Functions cannot be passed directly to Client Components/);
  }

  const pageTwo = await fetch(`${base}/search?q=diwali&page=2`);
  const pageTwoHtml = await pageTwo.text();
  assert.equal(pageTwo.status, 200);
  assert.ok(pageTwoHtml.includes("page <!-- -->2<!-- --> of <!-- -->31"));

  const filteredPage = await fetch(`${base}/search?q=character&avail=paid&orientation=portrait&sort=best-selling&page=2`);
  const filteredHtml = await filteredPage.text();
  assert.equal(filteredPage.status, 200);
  assert.ok(filteredHtml.includes("page <!-- -->2<!-- --> of <!-- -->"));
  assert.match(filteredHtml, /character/);

  const outOfRange = await fetch(`${base}/search?q=goa&page=99`, { redirect: "manual" });
  const outOfRangeHtml = await outOfRange.text();
  if (outOfRange.status === 307) {
    assert.equal(new URL(outOfRange.headers.get("location"), base).searchParams.get("page"), "2");
  } else {
    // Next streams server redirects as a meta refresh with HTTP 200 in dev mode.
    assert.match(outOfRangeHtml, /http-equiv="refresh" content="1;url=\/search\?q=goa&amp;page=2"/);
  }

  const invalidPage = await fetch(`${base}/search?q=goa&page=0`);
  const invalidHtml = await invalidPage.text();
  assert.equal(invalidPage.status, 200);
  assert.ok(invalidHtml.includes("page <!-- -->1<!-- --> of <!-- -->2"));

  const empty = await fetch(`${base}/search?q=zzunlikelycatalogueword`);
  const emptyHtml = await empty.text();
  assert.equal(empty.status, 200);
  assert.match(emptyHtml, /No results for/);

  const preview = await fetch(`${base}/gallery-preview?q=diwali&category=all`);
  const previewHtml = await preview.text();
  assert.equal(preview.status, 200, "Gallery Preview search status");
  assert.match(previewHtml, /Showing <!-- -->\d+<!-- --> of <!-- -->\d+<!-- --> products/);
  assert.doesNotMatch(previewHtml, /Functions cannot be passed directly to Client Components/);

  const defaultPreview = await fetch(`${base}/gallery-preview?q=diwali`);
  const defaultPreviewHtml = await defaultPreview.text();
  assert.equal(defaultPreview.status, 200);
  assert.match(defaultPreviewHtml, /No artwork found/);
  assert.doesNotMatch(defaultPreviewHtml, /Functions cannot be passed directly to Client Components/);
});
