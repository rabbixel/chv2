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
