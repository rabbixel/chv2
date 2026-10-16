#!/usr/bin/env node

import { readFile, stat, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { selectGalleryImages } from "../lib/creative-hatti/image-matching.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_UPLOADS = "C:\\laragon\\www\\creativehatti\\wp-content\\uploads";
const DEFAULT_ARCHIVE = "D:\\Works\\Rebuilding Tasks\\Creative Hatti\\wp-content\\uploads v2";
const MEDIA_TIMEOUT_MS = 10_000;
const MAX_CONCURRENCY = 8;

function loadDotEnv(file) {
  let contents;
  try {
    contents = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2];
    process.env[match[1]] = value.length >= 2 && value[0] === value.at(-1) && ["'", '"'].includes(value[0])
      ? value.slice(1, -1)
      : value;
  }
}

loadDotEnv(path.join(REPO_ROOT, ".env.local"));
loadDotEnv(path.join(REPO_ROOT, ".env"));

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function safeInteger(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

const apiBase = option("--api-url", process.env.CH_API_URL)?.replace(/\/$/, "");
if (!apiBase) {
  console.error("CH_API_URL is missing. Set it in .env.local or pass --api-url.");
  process.exit(1);
}
const mediaOrigin = new URL(apiBase).origin;
const uploadsRoot = path.resolve(option("--uploads-root", DEFAULT_UPLOADS));
const archiveRoot = path.resolve(option("--archive-root", DEFAULT_ARCHIVE));
const concurrency = safeInteger(option("--concurrency", "6"), 6, 1, MAX_CONCURRENCY);
const pageSize = safeInteger(option("--page-size", "5000"), 5000, 1, 5000);
const productLimit = safeInteger(option("--limit", "0"), 0, 0, Number.MAX_SAFE_INTEGER);
const reportPath = path.resolve(option("--output", path.join(REPO_ROOT, "missing-product-images.txt")));
const wpRoot = path.resolve(option("--wp-root", "C:/laragon/www/creativehatti"));
const phpExe = option("--php-exe", "C:/laragon/bin/php/php-8.3.33-Win32-vs16-x64/php.exe");

const productionHost = (() => {
  try {
    const configured = new URL(process.env.WORDPRESS_URL || "https://www.creativehatti.com");
    return ["creativehatti.test", "www.creativehatti.test"].includes(configured.hostname)
      ? "www.creativehatti.com"
      : configured.host;
  } catch {
    return "www.creativehatti.com";
  }
})();

function relativeUploadsPath(image) {
  const candidate = typeof image.source_file === "string" ? image.source_file : "";
  const parts = candidate.replaceAll("\\", "/").split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) return "";
  return parts.join("/");
}

function localPath(root, relative) {
  return path.join(root, ...relative.split("/"));
}

function uploadsUrl(relative) {
  const encoded = relative.split("/").map(encodeURIComponent).join("/");
  return new URL(`/wp-content/uploads/${encoded}`, mediaOrigin).toString();
}

function mediaFallbackUrl(url) {
  try {
    const parsed = new URL(url);
    if (!["creativehatti.test", "www.creativehatti.test"].includes(parsed.hostname)) return null;
    return new URL(`${parsed.pathname}${parsed.search}`, `https://${productionHost}`).toString();
  } catch {
    return null;
  }
}

async function loadForComparison(image) {
  const relative = relativeUploadsPath(image);
  if (relative) {
    for (const root of [uploadsRoot, archiveRoot]) {
      try {
        return await readFile(localPath(root, relative));
      } catch {
        // An absent local copy may still be available at the live media URL.
      }
    }
  }
  const candidates = [image.url, mediaFallbackUrl(image.url)].filter(Boolean);
  for (const url of [...new Set(candidates)]) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
        headers: { Accept: "image/*" },
      });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) continue;
      const size = Number(response.headers.get("content-length") || 0);
      if (size > 24 * 1024 * 1024) continue;
      const data = new Uint8Array(await response.arrayBuffer());
      if (data.byteLength <= 24 * 1024 * 1024) return data;
    } catch {
      // Continue to the next configured media origin.
    }
  }
  return null;
}

const responseCache = new Map();
async function localExists(relative) {
  if (!responseCache.has(`file:${relative}`)) {
    responseCache.set(`file:${relative}`, stat(localPath(uploadsRoot, relative))
      .then(() => true)
      .catch(() => false));
  }
  return responseCache.get(`file:${relative}`);
}

async function urlWorks(url) {
  if (!responseCache.has(`url:${url}`)) {
    responseCache.set(`url:${url}`, (async () => {
      try {
        let response = await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
        });
        if (response.status === 405 || response.status === 501) {
          response = await fetch(url, {
            headers: { Range: "bytes=0-0" },
            signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
          });
        }
        return response.ok;
      } catch {
        return false;
      }
    })());
  }
  return responseCache.get(`url:${url}`);
}

const missingByPath = new Map();
const missingProductIds = new Set();
const brokenUrlProductIds = new Set();
const noImageProductIds = new Set();
const referenceIssueProductIds = new Set();
const metadataIssueProductIds = new Set();
const failureProductIds = new Set();
let productsChecked = 0;
let totalProducts = 0;
let databaseAudit;

function addMissing(image, product, relative) {
  const key = relative.toLowerCase();
  if (!missingByPath.has(key)) {
    missingByPath.set(key, {
      productId: product.id,
      slug: product.slug,
      attachmentId: image.id ?? "",
      role: image.role || "Gallery",
      path: relative,
    });
  }
  missingProductIds.add(String(product.id));
}

function productImages(product) {
  return (product.images ?? []).flatMap((reference) => {
    const metadata = databaseAudit.attachment_files?.[String(reference.id)];
    if (!metadata?.source_file) return [];
    const relative = metadata.source_file.replaceAll("\\", "/");
    return [{
      id: String(reference.id),
      role: reference.role,
      url: uploadsUrl(relative),
      source_file: relative,
      original_file: metadata.original_file,
      width: metadata.width,
      height: metadata.height,
      alt: metadata.alt,
      parent_id: metadata.parent_id,
    }];
  });
}

async function inspectProduct(product) {
  try {
    const images = productImages(product);
    if (!images.length) return;

    const selection = await selectGalleryImages(images, loadForComparison);
    for (const image of selection.images) {
      const relative = relativeUploadsPath(image);
      if (!relative) {
        metadataIssueProductIds.add(String(product.id));
        continue;
      }
      if (!(await localExists(relative))) {
        addMissing(image, product, relative);
        continue;
      }
      if (!(await urlWorks(image.url))) brokenUrlProductIds.add(String(product.id));
    }
  } catch (error) {
    failureProductIds.add(String(product.id));
    console.error(`Could not audit product ${product.id} (${product.slug}): ${error.message}`);
  } finally {
    productsChecked += 1;
    if (productsChecked % 500 === 0) {
      console.log(`Checked ${productsChecked.toLocaleString()} / ${totalProducts.toLocaleString()} products`);
    }
  }
}

async function runPool(items, workerCount, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index]);
    }
  }));
}

console.log(`Auditing published products from the local WordPress catalogue`);
console.log(`Laragon uploads: ${uploadsRoot}`);
console.log(`Comparison archive: ${archiveRoot}`);
console.log(`Database page size: ${pageSize}; bounded image-check concurrency: ${concurrency}`);

const databaseJson = execFileSync(phpExe, [
  path.join(SCRIPT_DIR, "read-published-product-image-refs.php"),
  `--wp-root=${wpRoot}`,
  `--page-size=${pageSize}`,
], { maxBuffer: 128 * 1024 * 1024, encoding: "utf8" });
databaseAudit = JSON.parse(databaseJson);
totalProducts = Number(databaseAudit.total_products ?? 0);
if (!totalProducts || !Array.isArray(databaseAudit.products)) {
  throw new Error("The read-only WordPress audit did not return published products.");
}
for (const id of databaseAudit.no_image_product_ids ?? []) noImageProductIds.add(String(id));
for (const id of Object.keys(databaseAudit.reference_issues ?? {})) referenceIssueProductIds.add(String(id));
for (const id of Object.keys(databaseAudit.metadata_issues ?? {})) metadataIssueProductIds.add(String(id));

const productsToCheck = productLimit
  ? databaseAudit.products.slice(0, productLimit)
  : databaseAudit.products;
await runPool(productsToCheck, concurrency, inspectProduct);

const header = "Product ID | Product Slug | Attachment ID | Featured/Gallery | Relative uploads path";
const rows = [...missingByPath.values()]
  .sort((a, b) => a.path.localeCompare(b.path))
  .map((row) => `${row.productId} | ${row.slug} | ${row.attachmentId} | ${row.role} | ${row.path}`);
await writeFile(reportPath, `${header}\n${rows.join("\n")}${rows.length ? "\n" : ""}`, "utf8");

console.log("\nAudit summary");
console.log(`Products checked: ${productsChecked.toLocaleString()} / ${totalProducts.toLocaleString()}`);
for (const id of [...referenceIssueProductIds, ...metadataIssueProductIds, ...brokenUrlProductIds]) {
  missingProductIds.add(id);
}
console.log(`Products with missing required images: ${missingProductIds.size.toLocaleString()}`);
console.log(`Unique missing original files: ${missingByPath.size.toLocaleString()}`);
console.log(`Products with broken URLs despite existing local files: ${brokenUrlProductIds.size.toLocaleString()}`);
console.log(`Products with missing attachment references: ${referenceIssueProductIds.size.toLocaleString()}`);
console.log(`Products with missing attachment metadata: ${metadataIssueProductIds.size.toLocaleString()}`);
console.log(`Products with no image assigned: ${noImageProductIds.size.toLocaleString()}`);
console.log(`Products whose audit could not complete: ${failureProductIds.size.toLocaleString()}`);
console.log(`Report: ${reportPath}`);
