import assert from "node:assert/strict";
import test from "node:test";
import {
  largestGalleryImageIndex,
  selectDetailGalleryImages,
} from "../lib/creative-hatti/gallery-display.mjs";

test("drops the small featured image when a substantially larger preview exists", () => {
  const images = [
    { id: "30705", width: 400, height: 400 },
    { id: "30706", width: 900, height: 675 },
  ];

  assert.deepEqual(selectDetailGalleryImages(images).map((image) => image.id), ["30706"]);
});

test("preserves multiple larger previews in their existing order", () => {
  const images = [
    { id: "featured", width: 400, height: 400 },
    { id: "preview-a", width: 900, height: 675 },
    { id: "preview-b", width: 1200, height: 900 },
  ];

  assert.deepEqual(
    selectDetailGalleryImages(images).map((image) => image.id),
    ["preview-a", "preview-b"],
  );
});

test("retains a sole image, images with missing dimensions, and equal-size images", () => {
  const single = [{ id: "only", width: 200, height: 180 }];
  const unknown = [{ id: "unknown" }, { id: "large", width: 1200, height: 900 }];
  const equal = [{ id: "featured", width: 900, height: 675 }, { id: "preview", width: 900, height: 675 }];

  assert.deepEqual(selectDetailGalleryImages(single), single);
  assert.deepEqual(selectDetailGalleryImages(unknown), unknown);
  assert.deepEqual(selectDetailGalleryImages(equal), equal);
});

test("keeps a distinct image when the available alternative is not substantially larger", () => {
  const images = [
    { id: "featured", width: 600, height: 500 },
    { id: "preview", width: 800, height: 600 },
  ];

  assert.deepEqual(selectDetailGalleryImages(images), images);
});

test("selects the largest gallery image without changing image order", () => {
  const images = [
    { id: "featured", width: 400, height: 400 },
    { id: "watermarked", width: 900, height: 675 },
    { id: "detail", width: 750, height: 750 },
  ];

  assert.equal(largestGalleryImageIndex(images), 1);
  assert.deepEqual(images.map((image) => image.id), ["featured", "watermarked", "detail"]);
});

test("keeps the first image when dimensions are missing or tied", () => {
  assert.equal(largestGalleryImageIndex([{ width: 0 }, { width: 0 }]), 0);
  assert.equal(
    largestGalleryImageIndex([
      { width: 400, height: 400 },
      { width: 800, height: 200 },
    ]),
    0,
  );
});
