import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const [component, styles, admin, adminScript] = await Promise.all([
  readFile(new URL("../components/home/Hero.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/home/Hero.module.css", import.meta.url), "utf8"),
  readFile(new URL("../wordpress/creative-hatti-home-sections/creative-hatti-home-sections.php", import.meta.url), "utf8"),
  readFile(new URL("../wordpress/creative-hatti-home-sections/admin.js", import.meta.url), "utf8"),
]);
const headerStyles = await readFile(new URL("../components/layout/SiteHeader.module.css", import.meta.url), "utf8");
const tokens = await readFile(new URL("../styles/tokens.css", import.meta.url), "utf8");
const sharp = (await import("sharp")).default;

test("disabled Hero images skip gallery rendering and use the centered single-column layout", () => {
  assert.match(component, /const previews = config\.showImages\s*\?/);
  assert.match(component, /const gallery = config\.showImages \?/);
  assert.match(component, /gallery\.length > 0 \? styles\.withArtwork : styles\.centered/);
  assert.match(component, /!config\.showImages && styles\.centeredHero/);
  assert.match(styles, /\.centered\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  const centeredBackground = styles.match(/\.centeredHero\s*\{[^}]*\}/s)?.[0] ?? "";
  assert.match(centeredBackground, /creative-hatti-skyline\.webp/);
  assert.match(centeredBackground, /creative-hatti-starfield\.webp/);
  assert.ok(centeredBackground.indexOf("creative-hatti-skyline.webp") < centeredBackground.indexOf("creative-hatti-starfield.webp"));
  assert.match(centeredBackground, /background-size:\s*100%\s+auto,\s*cover/);
  assert.match(styles, /\.centeredHero \.inner\s*\{[^}]*padding-bottom:\s*max\(/s);
  assert.match(styles, /\.centeredHero\s*\{[^}]*background-color:\s*var\(--ch-brand-900\)/s);
  assert.match(headerStyles, /\.announcement\s*\{[^}]*background-color:\s*var\(--ch-brand-900\)/s);
  assert.match(tokens, /--ch-brand-900:\s*#191b60/i);
  assert.match(styles, /\.inner\s*\{[^}]*margin-inline:\s*auto;[^}]*text-align:\s*center/s);
  assert.match(styles, /\.stats\s*\{[^}]*flex-wrap:\s*wrap;[^}]*justify-content:\s*center/s);
  assert.match(styles, /\.withArtwork\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.2fr\)\s+minmax\(0,\s*1fr\)/s);
});

test("Homepage Manager persists the image visibility override and restores Default to enabled", () => {
  assert.ok(admin.includes("$hero['show_images'] = self::sanitize_override( $hero_input['show_images'] ?? null, 'boolean', true )"));
  assert.match(admin, /'show_images'\s*=>\s*array\(\s*'mode'/);
  assert.match(admin, /name="ch_home_sections\[v2\]\[hero\]\[show_images\]\[value\]"/);
  assert.match(adminScript, /\.ch-home-hero-artwork-visibility \.ch-home-override-mode select/);
  assert.match(adminScript, /\.ch-home-show-images-value/);
});

test("centered Hero artwork uses the top-bar navy and a brighter proportional skyline", async () => {
  const brandHex = tokens.match(/--ch-brand-900:\s*#([0-9a-f]{6})/i)?.[1];
  assert.ok(brandHex);
  const brandRgb = brandHex.match(/.{2}/g).map((value) => Number.parseInt(value, 16));
  const starfield = await sharp(fileURLToPath(new URL("../public/images/creative-hatti-starfield.webp", import.meta.url))).raw().toBuffer({ resolveWithObject: true });
  const skyline = await sharp(fileURLToPath(new URL("../public/images/creative-hatti-skyline.webp", import.meta.url))).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([starfield.info.width, starfield.info.height], [1903, 300]);
  assert.deepEqual(Array.from(starfield.data.subarray(0, 3)), brandRgb);
  assert.deepEqual([skyline.info.width, skyline.info.height, skyline.info.channels], [1903, 117, 4]);
  const visible = skyline.data.findIndex((value, index) => index % 4 === 3 && value > 250);
  const visiblePixel = Math.floor(visible / 4) * 4;
  assert.deepEqual(Array.from(skyline.data.subarray(visiblePixel, visiblePixel + 3)), [0x2e, 0x4a, 0x93]);
});
