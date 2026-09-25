import type { ID, Slug } from "./common";

export type CollectionKind = "festival" | "seasonal" | "topical";

/**
 * A curated, editorial collection (Diwali, Navratri, Logo Templates, …).
 * Collections are a discovery layer above the taxonomy: `query` powers the
 * collection in mock mode and maps to a search-index query in production.
 */
export interface Collection {
  id: ID;
  slug: Slug;
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
