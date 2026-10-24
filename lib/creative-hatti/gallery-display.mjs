const FEATURED_THUMBNAIL_SCALE = 1.5;
const FEATURED_THUMBNAIL_AREA_RATIO = 3;

/**
 * Remove the leading featured thumbnail only when a gallery alternative is
 * clearly larger in both dimensions and overall pixel area. Keep array order.
 */
export function selectDetailGalleryImages(images) {
  if (images.length < 2) return images;

  const featured = images[0];
  const width = Number(featured.width ?? 0);
  const height = Number(featured.height ?? 0);
  const area = width * height;
  if (width <= 0 || height <= 0 || area <= 0) return images;

  const hasLargerPreview = images.slice(1).some((image) => {
    const alternateWidth = Number(image.width ?? 0);
    const alternateHeight = Number(image.height ?? 0);
    const alternateArea = alternateWidth * alternateHeight;
    return alternateWidth >= width * FEATURED_THUMBNAIL_SCALE &&
      alternateHeight >= height * FEATURED_THUMBNAIL_SCALE &&
      alternateArea >= area * FEATURED_THUMBNAIL_AREA_RATIO;
  });

  return hasLargerPreview ? images.slice(1) : images;
}

/** Return the position of the largest available gallery image without sorting it. */
export function largestGalleryImageIndex(images) {
  let largestIndex = 0;
  let largestArea = 0;

  for (const [position, image] of images.entries()) {
    const area = Number(image.width ?? 0) * Number(image.height ?? 0);
    if (area > largestArea) {
      largestArea = area;
      largestIndex = position;
    }
  }

  return largestIndex;
}
