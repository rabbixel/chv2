export interface MatchableProductImage {
  id: string;
  url: string;
  width?: number;
  height?: number;
  sourceFile?: string;
}

export interface GalleryDuplicate<TImage extends MatchableProductImage> {
  kept: TImage;
  discarded: TImage;
  reason: "same-attachment" | "confirmed-content-match";
}

export function selectGalleryImages<TImage extends MatchableProductImage>(
  images: TImage[],
  loadImage: (image: TImage) => Promise<Uint8Array | null>,
): Promise<{ images: TImage[]; duplicates: GalleryDuplicate<TImage>[] }>;

export function galleryComparisonCandidates(
  images: MatchableProductImage[],
): Array<[number, number]>;
