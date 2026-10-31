import type { Product } from "@/lib/types";

export interface JustifiedGalleryRow {
  height: number;
  items: Array<{ item: Product; width: number }>;
}

export function buildJustifiedRows(
  items: Product[],
  containerWidth: number,
  targetHeight: number,
  gap?: number,
): JustifiedGalleryRow[];
