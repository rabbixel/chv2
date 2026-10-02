import type { ProductImage } from "./product";

export type CardArtworkVariant =
  | "mythology"
  | "profession"
  | "cultural"
  | "festival"
  | "shivratri"
  | "republic-day"
  | "vasant-panchami"
  | "valentine"
  | "navratri";

export interface HomepageCharacterCategory {
  name: string;
  blurb: string;
  query: string;
  categorySlug: string;
  hue: number;
  artwork: CardArtworkVariant;
  count: number;
  image?: ProductImage;
}
