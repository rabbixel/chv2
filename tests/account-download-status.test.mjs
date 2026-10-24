import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getCustomerDownloadPresentation } from "../lib/services/customerDownloadPresentation.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("dashboard and downloads page share EDD download availability and actions", async () => {
  const [dashboard, downloads, actions, component] = await Promise.all([
    read("../app/account/page.tsx"),
    read("../app/account/downloads/page.tsx"),
    read("../components/account/CustomerDownloadActions.tsx"),
    read("../components/account/DownloadButton.tsx"),
  ]);

  assert.match(dashboard, /getCustomerDownloadService\(\)\.list/);
  assert.match(dashboard, /<CustomerDownloadActions item=\{item\} \/>/);
  assert.doesNotMatch(dashboard, /Delivery not enabled/);
  assert.match(downloads, /getCustomerDownloadService\(\)\.list/);
  assert.match(downloads, /<CustomerDownloadActions item=\{item\} \/>/);
  assert.match(actions, /getCustomerDownloadPresentation\(item\)/);
  assert.match(actions, /item\.files\.map\(\(file\)/);
  assert.match(actions, /orderItemId=\{item\.orderItemId\}/);
  assert.match(component, /requestCustomerDownloadAction/);
});

test("download controls do not claim S3 object existence and handle expired EDD access", async () => {
  const [downloadsPage, dashboard, accountActions] = await Promise.all([
    read("../app/account/downloads/page.tsx"),
    read("../app/account/page.tsx"),
    read("../app/account/actions.ts"),
  ]);
  assert.match(downloadsPage, /A link being available does not guarantee that the file itself can be retrieved/);
  assert.match(dashboard, /CustomerDownloadActions item=\{item\}/);
  assert.match(accountActions, /Download access is no longer available or may have expired/);
  assert.doesNotMatch(accountActions, /S3 object exists/);
});

test("availability presentation covers configured, missing, unavailable, and expired access states", () => {
  const base = { entitledFileCount: 1, downloadEnabled: true, files: [{ key: "0", name: "asset.zip" }] };
  assert.equal(getCustomerDownloadPresentation({ ...base, availability: "available" }).message, "Available");
  assert.match(getCustomerDownloadPresentation({ ...base, availability: "no_entitled_files", entitledFileCount: 0, files: [] }).message, /No files are available/);
  assert.match(getCustomerDownloadPresentation({ ...base, availability: "product_unavailable" }).message, /Download unavailable/);
  assert.match(getCustomerDownloadPresentation({ ...base, availability: "delivery_disabled" }).message, /may have expired/);
  assert.equal(getCustomerDownloadPresentation({ ...base, availability: "available", downloadEnabled: false }).state, "unavailable");
});

test("shared download actions keep long names and multiple files inside a full-width action area", async () => {
  const [actions, actionCss, accountCss, dashboard, downloads] = await Promise.all([
    read("../components/account/CustomerDownloadActions.tsx"),
    read("../components/account/CustomerDownloadActions.module.css"),
    read("../app/account/section.module.css"),
    read("../app/account/page.tsx"),
    read("../app/account/downloads/page.tsx"),
  ]);

  assert.match(actions, /item\.files\.map\(\(file\)/);
  assert.match(actions, /title=\{file\.name\}/);
  assert.match(actionCss, /text-overflow:\s*ellipsis/);
  assert.match(actionCss, /-webkit-line-clamp:\s*2/);
  assert.match(accountCss, /\.purchaseRow\s*\{[^}]*display:\s*grid/s);
  assert.match(accountCss, /\.purchaseActions\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s);
  assert.match(dashboard, /styles\.purchaseActions/);
  assert.match(downloads, /styles\.purchaseActions/);
});
