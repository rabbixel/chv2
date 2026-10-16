import sharp from "sharp";

const HASH_SIZE = 32;
const HASH_FREQUENCIES = 8;
const MAX_IMAGE_BYTES = 24 * 1024 * 1024;
const MAX_ASPECT_DELTA = 0.015;
const MIN_AREA_RATIO = 1.35;
const MAX_HASH_DISTANCE = 5;
const MAX_MEAN_PIXEL_DELTA = 12;

const cosine = Array.from({ length: HASH_FREQUENCIES }, (_, frequency) =>
  Array.from({ length: HASH_SIZE }, (_, position) =>
    Math.cos(((2 * position + 1) * frequency * Math.PI) / (2 * HASH_SIZE)),
  ),
);

function area(image) {
  return Number(image.width || 0) * Number(image.height || 0);
}

function isResolutionCandidate(a, b) {
  const aArea = area(a);
  const bArea = area(b);
  if (!aArea || !bArea) return true;
  const aRatio = Number(a.width) / Number(a.height);
  const bRatio = Number(b.width) / Number(b.height);
  const aspectDelta = Math.abs(aRatio - bRatio) / Math.max(aRatio, bRatio);
  return aspectDelta <= MAX_ASPECT_DELTA &&
    Math.min(aArea, bArea) / Math.max(aArea, bArea) <= 1 / MIN_AREA_RATIO;
}

export function galleryComparisonCandidates(images) {
  const pairs = [];
  for (let left = 0; left < images.length; left += 1) {
    for (let right = left + 1; right < images.length; right += 1) {
      if (isResolutionCandidate(images[left], images[right])) pairs.push([left, right]);
    }
  }
  return pairs;
}

function pHash(gray) {
  const coefficients = [];
  for (let vertical = 0; vertical < HASH_FREQUENCIES; vertical += 1) {
    for (let horizontal = 0; horizontal < HASH_FREQUENCIES; horizontal += 1) {
      if (vertical === 0 && horizontal === 0) continue;
      let sum = 0;
      for (let y = 0; y < HASH_SIZE; y += 1) {
        const verticalWeight = cosine[vertical][y];
        for (let x = 0; x < HASH_SIZE; x += 1) {
          sum += gray[y * HASH_SIZE + x] * verticalWeight * cosine[horizontal][x];
        }
      }
      coefficients.push(sum);
    }
  }
  const sorted = [...coefficients].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return coefficients.map((value) => value > median);
}

async function signature(bytes) {
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
  try {
    const source = sharp(bytes, { limitInputPixels: 80_000_000 });
    const sourceMetadata = await source.metadata();
    const { data, info } = await sharp(bytes, { limitInputPixels: 80_000_000 })
      .rotate()
      .resize(HASH_SIZE, HASH_SIZE, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.channels < 3) return null;
    const gray = new Float64Array(HASH_SIZE * HASH_SIZE);
    for (let i = 0, pixel = 0; pixel < gray.length; pixel += 1, i += info.channels) {
      gray[pixel] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return {
      width: sourceMetadata.width ?? info.width,
      height: sourceMetadata.height ?? info.height,
      hash: pHash(gray),
      pixels: data,
      channels: info.channels,
    };
  } catch {
    return null;
  }
}

function sameArtwork(a, b) {
  let hashDistance = 0;
  for (let i = 0; i < a.hash.length; i += 1) {
    if (a.hash[i] !== b.hash[i]) hashDistance += 1;
  }
  if (hashDistance > MAX_HASH_DISTANCE) return false;

  let pixelDelta = 0;
  for (let i = 0; i < a.pixels.length; i += 1) {
    pixelDelta += Math.abs(a.pixels[i] - b.pixels[i]);
  }
  return pixelDelta / a.pixels.length <= MAX_MEAN_PIXEL_DELTA;
}

/**
 * Remove only confirmed image duplicates. Dimensions narrow the candidate
 * pairs; perceptual and pixel comparisons confirm identity before anything
 * is removed. Distinct images retain their original order.
 */
export async function selectGalleryImages(images, loadImage) {
  const selected = new Set(images.map((_, index) => index));
  const duplicates = [];
  const signatures = new Map();

  const getSignature = async (index) => {
    if (!signatures.has(index)) {
      signatures.set(index, (async () => {
        try {
          return await signature(await loadImage(images[index]));
        } catch {
          return null;
        }
      })());
    }
    return signatures.get(index);
  };

  // A repeated WordPress attachment ID is definitive identity. Keep its
  // highest-dimensional occurrence, using first position to break ties.
  const byIdentity = new Map();
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const identity = image.sourceFile
      ? `file:${String(image.sourceFile).toLowerCase()}`
      : image.id
        ? `id:${String(image.id)}`
        : "";
    if (!identity) continue;
    const previous = byIdentity.get(identity);
    if (previous === undefined) {
      byIdentity.set(identity, index);
      continue;
    }
    const winner = area(images[index]) > area(images[previous]) ? index : previous;
    const loser = winner === index ? previous : index;
    selected.delete(loser);
    duplicates.push({ kept: images[winner], discarded: images[loser], reason: "same-attachment" });
    byIdentity.set(identity, winner);
  }

  for (const [left, right] of galleryComparisonCandidates(images)) {
    if (!selected.has(left)) continue;
    if (!selected.has(right)) continue;
    const [leftSignature, rightSignature] = await Promise.all([
      getSignature(left),
      getSignature(right),
    ]);
    if (!leftSignature || !rightSignature || !sameArtwork(leftSignature, rightSignature)) continue;

    const leftArea = area(images[left]) || leftSignature.width * leftSignature.height;
    const rightArea = area(images[right]) || rightSignature.width * rightSignature.height;
    const winner = rightArea > leftArea ? right : left;
    const loser = winner === left ? right : left;
    selected.delete(loser);
    duplicates.push({ kept: images[winner], discarded: images[loser], reason: "confirmed-content-match" });
  }

  return {
    images: images.filter((_, index) => selected.has(index)),
    duplicates,
  };
}
