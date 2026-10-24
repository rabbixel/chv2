import assert from "node:assert/strict";
import test from "node:test";
import { largestGalleryImageIndex } from "../lib/creative-hatti/gallery-display.mjs";

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
