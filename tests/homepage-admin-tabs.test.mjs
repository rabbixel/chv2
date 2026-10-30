import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pluginFile = new URL("../wordpress/creative-hatti-home-sections/creative-hatti-home-sections.php", import.meta.url);
const scriptFile = new URL("../wordpress/creative-hatti-home-sections/admin.js", import.meta.url);
const php = await readFile(pluginFile, "utf8");
const js = await readFile(scriptFile, "utf8");

test("admin assets are cache-busted from their own file modification times", () => {
  assert.match(php, /filemtime\(\s*\$admin_css_path\s*\)/);
  assert.match(php, /filemtime\(\s*\$admin_js_path\s*\)/);
  assert.match(php, /array\(\s*'jquery'\s*\)/);
});

test("Hero sub-tabs delegate click handling and activate Content on entry", () => {
  assert.match(js, /\$\(document\)\.on\("click", "\.ch-home-subtab"/);
  assert.match(js, /if \(tab === "hero"\) activateHeroTab\("content"\)/);
  assert.match(js, /activateHeroTab\("content"\);/);
});

test("switching a Hero panel updates visibility and accessible selection without rebuilding fields", () => {
  assert.match(js, /\$\("\.ch-home-hero-subpanel"\)\.prop\("hidden", true\)\.attr\("aria-hidden", "true"\)/);
  assert.match(js, /\$\("#ch-hero-panel-" \+ tab\)\.prop\("hidden", false\)\.attr\("aria-hidden", "false"\)/);
  assert.match(js, /\$button\.attr\("aria-selected", "true"\)/);
  const activation = js.match(/function activateHeroTab\(tab\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.notEqual(activation, "");
  assert.doesNotMatch(activation, /\.html\(|\.val\(/);
});
