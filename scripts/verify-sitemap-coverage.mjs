#!/usr/bin/env node
/**
 * Compare local sitemap product URLs against published, unprotected EDD
 * downloads. This is read-only. By default it checks the first and last
 * product chunks; pass --full for a complete, deliberately rate-limited scan.
 *
 * Example (PowerShell):
 *   $env:SITEMAP_BASE_URL = 'http://localhost:3000'
 *   $env:CH_WP_ROOT = 'C:\\laragon\\www\\creativehatti'
 *   node scripts/verify-sitemap-coverage.mjs
 *   node scripts/verify-sitemap-coverage.mjs --full
 */
import { spawnSync } from "node:child_process";

const CHUNK_SIZE = 48;
const DEFAULT_WP_ROOT = "C:\\laragon\\www\\creativehatti";
const DEFAULT_PHP =
  "C:\\laragon\\bin\\php\\php-8.3.33-Win32-vs16-x64\\php.exe";
const fullScan = process.argv.includes("--full");
const base = new URL(process.env.SITEMAP_BASE_URL || "http://localhost:3000");
const wpRoot = process.env.CH_WP_ROOT || DEFAULT_WP_ROOT;
const php = process.env.PHP_CLI || DEFAULT_PHP;
const siteUrl = new URL(
  (process.env.EXPECTED_SITE_URL || "https://www.creativehatti.com").replace(/\/$/, ""),
);

if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
  throw new Error("Safety stop: SITEMAP_BASE_URL must point to localhost.");
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function xmlLocations(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/gs)].map((match) =>
    decodeXml(match[1].trim()),
  );
}

async function getText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

function readEligibleProducts() {
  const phpCode = String.raw`
    define('WP_USE_THEMES', false);
    ini_set('display_errors', '0');
    $_SERVER['REQUEST_SCHEME'] = 'http';
    $_SERVER['HTTP_HOST'] = 'creativehatti.test';
    $_SERVER['SERVER_NAME'] = 'creativehatti.test';
    $_SERVER['SERVER_PORT'] = '80';
    require rtrim(getenv('CH_WP_ROOT'), "\\/") . '/wp-load.php';
    global $wpdb;
    $sql = $wpdb->prepare(
      "SELECT ID, post_name AS slug FROM " . $wpdb->posts . " WHERE post_type = %s AND post_status = %s AND post_password = %s ORDER BY ID ASC",
      'download', 'publish', ''
    );
    $rows = $wpdb->get_results($sql, ARRAY_A);
    if ($wpdb->last_error) { fwrite(STDERR, $wpdb->last_error . PHP_EOL); exit(2); }
    echo wp_json_encode(array_map(static function ($row) {
      return array('id' => (int) $row['ID'], 'slug' => (string) $row['slug']);
    }, $rows));
  `;
  const result = spawnSync(php, ["-r", phpCode], {
    encoding: "utf8",
    env: { ...process.env, CH_WP_ROOT: wpRoot },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Local WordPress read failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function validateProductChunk(xml, expectedRows) {
  const expectedSlugs = expectedRows.map((row) => row.slug);
  const expectedIds = new Map(expectedRows.map((row) => [row.slug, row.id]));
  const locations = xmlLocations(xml);
  const seenSlugs = new Set();
  const missing = [];
  const duplicateUrls = [];
  const extraUrls = [];
  const wrongDomain = [];
  const wrongRoute = [];

  for (const location of locations) {
    let url;
    try {
      url = new URL(location);
    } catch {
      wrongRoute.push(location);
      continue;
    }
    if (url.origin !== siteUrl.origin) wrongDomain.push(location);
    const match = url.pathname.match(/^\/product\/([^/]+)\/?$/);
    if (!match || url.search || url.hash) {
      wrongRoute.push(location);
      continue;
    }
    let slug;
    try {
      slug = decodeURIComponent(match[1]);
    } catch {
      wrongRoute.push(location);
      continue;
    }
    if (!expectedIds.has(slug)) extraUrls.push(location);
    if (seenSlugs.has(slug)) duplicateUrls.push(location);
    seenSlugs.add(slug);
  }

  for (const row of expectedRows) {
    if (!seenSlugs.has(row.slug)) missing.push({ id: row.id, slug: row.slug });
  }
  if (locations.length !== expectedSlugs.length) {
    for (const row of expectedRows) {
      const expectedUrl = `${siteUrl.origin}/product/${encodeURIComponent(row.slug)}`;
      if (!locations.includes(expectedUrl) && !missing.some((item) => item.id === row.id)) {
        missing.push({ id: row.id, slug: row.slug });
      }
    }
  }

  return { locations: locations.length, slugs: [...seenSlugs], missing, duplicateUrls, extraUrls, wrongDomain, wrongRoute };
}

const products = readEligibleProducts();
const expectedCount = products.length;
const productChunkCount = Math.ceil(expectedCount / CHUNK_SIZE);
const indexXml = await getText(new URL("/sitemap.xml", base));
const indexLocations = xmlLocations(indexXml);
const rawChunkIds = [];
let badIndexUrl = false;
for (const location of indexLocations) {
  try {
    const url = new URL(location);
    const match = url.pathname.match(/^\/sitemap\/(\d+)\.xml$/);
    if (url.origin !== siteUrl.origin || !match || url.search || url.hash) {
      badIndexUrl = true;
      continue;
    }
    rawChunkIds.push(Number(match[1]));
  } catch {
    badIndexUrl = true;
  }
}
const indexedChunkIds = [...new Set(rawChunkIds)].sort((a, b) => a - b);
const expectedChunkIds = Array.from({ length: productChunkCount + 1 }, (_, id) => id);
const badIndex =
  badIndexUrl ||
  rawChunkIds.length !== expectedChunkIds.length ||
  new Set(rawChunkIds).size !== rawChunkIds.length ||
  indexedChunkIds.length !== expectedChunkIds.length ||
  indexedChunkIds.some((id, index) => id !== expectedChunkIds[index]);
const expectedSlugIds = new Map();
for (const product of products) {
  const ids = expectedSlugIds.get(product.slug) ?? [];
  ids.push(product.id);
  expectedSlugIds.set(product.slug, ids);
}
const duplicateDatabaseSlugs = [...expectedSlugIds.entries()]
  .filter(([, ids]) => ids.length > 1)
  .map(([slug, ids]) => `${slug}:${ids.join("+")}`);
const productIds = fullScan
  ? expectedChunkIds.slice(1)
  : [...new Set([1, productChunkCount])].filter((id) => id > 0);
const concurrency = fullScan ? 2 : 1;
const results = [];
let next = 0;

async function worker() {
  while (next < productIds.length) {
    const chunkId = productIds[next++];
    const start = (chunkId - 1) * CHUNK_SIZE;
    const expectedRows = products.slice(start, start + CHUNK_SIZE);
    const chunkUrl = new URL(`/sitemap/${chunkId}.xml`, base);
    const xml = await getText(chunkUrl);
    results.push({ chunkId, ...validateProductChunk(xml, expectedRows) });
    if (fullScan) await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
results.sort((a, b) => a.chunkId - b.chunkId);
const totals = results.reduce(
  (sum, result) => ({
    urls: sum.urls + result.locations,
    slugs: sum.slugs.concat(result.slugs),
    missing: sum.missing.concat(result.missing),
    duplicateUrls: sum.duplicateUrls.concat(result.duplicateUrls),
    extraUrls: sum.extraUrls.concat(result.extraUrls),
    wrongDomain: sum.wrongDomain.concat(result.wrongDomain),
    wrongRoute: sum.wrongRoute.concat(result.wrongRoute),
  }),
  { urls: 0, slugs: [], missing: [], duplicateUrls: [], extraUrls: [], wrongDomain: [], wrongRoute: [] },
);
const observedGlobally = new Set();
const crossChunkDuplicates = [];
for (const slug of totals.slugs) {
  if (observedGlobally.has(slug)) crossChunkDuplicates.push(slug);
  observedGlobally.add(slug);
}

console.log(`eligible_products=${expectedCount}`);
console.log(`product_chunks=${productChunkCount} indexed_chunks=${indexedChunkIds.length - 1}`);
console.log(`mode=${fullScan ? "full" : "boundary-sample"} verified_chunks=${results.length}`);
console.log(`verified_product_urls=${totals.urls}`);
console.log(`missing=${totals.missing.length} duplicate_urls=${totals.duplicateUrls.length + crossChunkDuplicates.length} extra=${totals.extraUrls.length}`);
console.log(`duplicate_db_slugs=${duplicateDatabaseSlugs.length} wrong_domain=${totals.wrongDomain.length} wrong_route=${totals.wrongRoute.length} bad_index=${badIndex}`);
if (totals.missing.length) console.log(`missing_ids=${totals.missing.map((item) => item.id).join(",")}`);
if (totals.duplicateUrls.length || crossChunkDuplicates.length) console.log(`duplicate_urls=${[...totals.duplicateUrls, ...crossChunkDuplicates].join(",")}`);
if (totals.extraUrls.length) console.log(`extra_urls=${totals.extraUrls.join(",")}`);
if (totals.wrongDomain.length) console.log(`wrong_domain_urls=${totals.wrongDomain.join(",")}`);
if (totals.wrongRoute.length) console.log(`wrong_route_urls=${totals.wrongRoute.join(",")}`);
if (fullScan) console.log("safety=localhost only; max concurrency 2; 250ms delay per worker");
if (duplicateDatabaseSlugs.length) console.log(`duplicate_db_slug_values=${duplicateDatabaseSlugs.join(",")}`);

if (
  badIndex ||
  duplicateDatabaseSlugs.length ||
  totals.missing.length ||
  totals.duplicateUrls.length ||
  crossChunkDuplicates.length ||
  totals.extraUrls.length ||
  totals.wrongDomain.length ||
  totals.wrongRoute.length
) {
  process.exitCode = 1;
}
