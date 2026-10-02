import type { ID, Slug } from "./common";
import type { ProductImage } from "./product";
import type { CardArtworkVariant } from "./homepage";

export type CollectionKind = "festival" | "seasonal" | "topical";

/**
 * A curated, editorial collection (Diwali, Navratri, Logo Templates, …).
 * Collections are a discovery layer above the taxonomy: `query` powers the
 * collection in mock mode and maps to a search-index query in production.
 */
export interface Collection {
  id: ID;
  slug: Slug;
  /** Product used as the collection card cover when its image is available. */
  coverProductSlug?: Slug;
  /** Optional category target and editorial artwork for homepage cards. */
  categorySlug?: Slug;
  href?: string;
  coverImage?: ProductImage;
  artwork?: CardArtworkVariant;
  title: string;
  tagline: string;
  query: string;
  /** Flat-art hue (0–360) until real collection covers exist. */
  hue: number;
  kind: CollectionKind;
  /** Shown in the "Featured Graphics Pack" section. */
  featured?: boolean;
  /** Shown in the seasonal/topical discovery grid. */
  seasonal?: boolean;
  sortOrder: number;
}
