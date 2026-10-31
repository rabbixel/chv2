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

test("Hero previews fall back to existing originals without dropping saved attachments", () => {
  assert.match(php, /private static function available_attachment_image_url/);
  assert.match(php, /return is_file\( \$original_path \) \? \( wp_get_attachment_url/);
  assert.match(php, /if \( is_file\( \$intermediate_path \) \) \{\s*return \$source\[0\];/);
  assert.match(php, /is_file\( \$original_path \).*wp_get_attachment_url\( \$attachment_id \)/);
  assert.match(php, /self::available_attachment_image_url\( \$image_id, 'medium' \)/);
  assert.match(php, /private static function hero_image_dto/);
  assert.match(php, /'image' => \$custom && \$image_id \? self::hero_image_dto\( \$image_id \) : null/);
  assert.match(js, /var source = attachment\.url/);
  assert.match(js, /saved selection retained/i);
});

test("Hero image destinations are independent, backwards compatible and serialized for Next.js", () => {
  assert.match(php, /'destination_type' => \$destination_type/);
  assert.match(php, /'search_keyword' => \$search_keyword/);
  assert.match(php, /\$destination_type = \$link_url \? 'custom_url' : 'default_product'/);
  assert.match(php, /\$raw_search_keyword[\s\S]*?sanitize_text_field\( \(string\) \$raw_search_keyword \)/);
  assert.match(php, /\]\[destination_type\]"/);
  assert.match(php, /data-destination-preview/);
  assert.doesNotMatch(php, /\$custom_preview\s*\?/);
  assert.match(js, /function syncHeroDestination\(\$slot\)/);
  assert.match(js, /encodeURIComponent\(keyword\)/);
  const imageSync = js.match(/function syncHeroImageSlot\(\$slot, nextMode, previousMode\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.doesNotMatch(imageSync, /link_url|\$link/);
});

test("Hero sub-tabs delegate click handling and activate Content on entry", () => {
  assert.match(js, /\$\(document\)\.on\("click", "\.ch-home-subtab\[data-hero-tab\]"/);
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

test("Homepage section Content and Items controls switch in place and expose v2 sparse settings", () => {
  assert.match(php, /render_inner_tabs\( \$key \)/);
  assert.match(php, /data-section-pane="content"/);
  assert.match(php, /data-section-pane="items"/);
  assert.match(php, /\[v2\]\[sections\]/);
  assert.match(js, /function activateSectionSubtab\(target, tab\)/);
  assert.match(js, /\[data-section-subtab\]/);
});

test("manual homepage product selection uses bounded admin AJAX and keeps ordered IDs on mode changes", () => {
  assert.match(php, /wp_ajax_ch_home_product_search/);
  assert.match(php, /check_ajax_referer\( 'ch_home_product_search'/);
  assert.match(php, /posts_per_page' => self::PRODUCT_SEARCH_LIMIT/);
  assert.match(php, /MAX_HATTI_CHOICE_PRODUCTS = 8/);
  assert.match(php, /MAX_POPULAR_FREEBIE_PRODUCTS = 8/);
  assert.match(php, /Pricing metadata is missing or invalid; the product cannot be confirmed free/);
  assert.match(php, /Product contains paid price options/);
  assert.match(php, /'free' === \$price_class/);
  assert.match(php, /data-product-search/);
  assert.match(js, /action: "ch_home_product_search"/);
  assert.match(js, /Saved manual IDs are kept for when you switch back/);
  assert.match(js, /data-product-restore/);
  assert.match(js, /selectedProductMarkup/);
});
