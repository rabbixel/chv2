/**
 * Select the product's primary/card artwork when available.
 * Detail responses append larger gallery assets after the featured image;
 * choosing the largest asset makes manually selected cards differ from search
 * results, whose image list contains only the compact card artwork.
 */
export function popularFreebieArtwork(images) {
  return images.find((image) => typeof image.url === "string" && image.url.trim().length > 0);
}
