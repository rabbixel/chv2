export interface GalleryDisplayImage {
  width?: number;
  height?: number;
}

export function selectDetailGalleryImages<TImage extends GalleryDisplayImage>(
  images: TImage[],
): TImage[];

export function largestGalleryImageIndex(images: GalleryDisplayImage[]): number;
