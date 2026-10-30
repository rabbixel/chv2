import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(
  new URL("../components/home/FeaturedPacks.tsx", import.meta.url),
  "utf8",
);
const gridCss = await readFile(
  new URL("../components/home/FeaturedPacks.module.css", import.meta.url),
  "utf8",
);
const artworkCss = await readFile(
  new URL("../components/home/CardArtwork.module.css", import.meta.url),
  "utf8",
);
const componentCss = await readFile(
  new URL("../components/home/FeaturedPacks.module.css", import.meta.url),
  "utf8",
);

function desktopPlacements(count) {
  const placements = [];
  let row = 1;
  let track = 1;

  for (let index = 0; index < count; index += 1) {
    const span = index === 0 ? 2 : 1;
    if (track + span - 1 > 4) {
      row += 1;
      track = 1;
    }
    placements.push({ row, track, span });
    track += span;
  }

  return placements;
}

test("featured packs preserve WordPress order and feature only the first supplied item", () => {
  assert.match(component, /packsWithImages\.map\(\(pack, index\)/);
  assert.match(component, /renderCard\(pack, index === 0\)/);
  assert.doesNotMatch(component, /packsWithImages\.sort\(/);
  assert.doesNotMatch(component, /maha-shivratri|republic-day|vasant-panchami|valentine-day/);
});

test("desktop layout uses four tracks and the lead card spans two", () => {
  assert.match(gridCss, /@media \(min-width: 1024px\)[\s\S]*?\.grid\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(gridCss, /\.lead\s*\{\s*grid-column:\s*span 2;/);
  assert.doesNotMatch(componentCss, /max-width:\s*1040px|margin-inline:\s*auto/);
});

test("card placement stays predictable from one through five desktop cards", () => {
  assert.deepEqual(desktopPlacements(1), [{ row: 1, track: 1, span: 2 }]);
  assert.deepEqual(desktopPlacements(2), [
    { row: 1, track: 1, span: 2 },
    { row: 1, track: 3, span: 1 },
  ]);
  assert.deepEqual(desktopPlacements(3), [
    { row: 1, track: 1, span: 2 },
    { row: 1, track: 3, span: 1 },
    { row: 1, track: 4, span: 1 },
  ]);
  assert.deepEqual(desktopPlacements(4), [
    { row: 1, track: 1, span: 2 },
    { row: 1, track: 3, span: 1 },
    { row: 1, track: 4, span: 1 },
    { row: 2, track: 1, span: 1 },
  ]);
  assert.deepEqual(desktopPlacements(5), [
    { row: 1, track: 1, span: 2 },
    { row: 1, track: 3, span: 1 },
    { row: 1, track: 4, span: 1 },
    { row: 2, track: 1, span: 1 },
    { row: 2, track: 2, span: 1 },
  ]);
});

test("tablet and mobile layouts respond without cropping thumbnail artwork", () => {
  assert.match(gridCss, /grid-template-columns:\s*1fr/);
  assert.match(gridCss, /@media \(min-width: 640px\)[\s\S]*?\.grid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(artworkCss, /\.image\s*\{[^}]*object-fit:\s*contain/s);
  assert.doesNotMatch(artworkCss, /object-fit:\s*cover/);
  assert.match(component, /pack\.image\?\.width\s*&&/);
  assert.match(component, /aspectRatio:\s*imageAspectRatio/);
  assert.doesNotMatch(componentCss, /position:\s*absolute|margin-top:\s*-/);
  assert.doesNotMatch(componentCss, /max-width:|margin-inline:/);
  assert.match(componentCss, /\.body\s*\{[^}]*flex:\s*1/s);
});
