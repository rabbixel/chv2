import type { ID, ISODateString, Money, Slug } from "./common";
import type { LicenseCode } from "./license";

export type ProductStatus = "active" | "draft" | "archived";

export interface ProductImage {
  id: ID;
  /** CDN URL. Empty while running on mock data (see `placeholder`). */
  url: string;
  alt: string;
  width?: number;
  height?: number;
  /**
   * Deterministic flat placeholder used until real CDN imagery exists.
   * `hue` is 0–360; the card renders a flat swatch + monogram (no gradients).
   */
  placeholder?: {
    hue: number;
    label: string;
  };
}

export interface ProductAttribute {
  name: string;
  value: string;
}

export interface ProductVendor {
  id: ID;
  name: string;
}

export interface Product {
  id: ID;
  slug: Slug;
  title: string;
  subtitle?: string;
  shortDescription?: string;
  description?: string;

  /** Base price (personal license) in minor units. */
  price: Money;
  /** Original price when on sale; absent otherwise. */
  compareAtPrice?: Money;

  status: ProductStatus;
  categoryIds: ID[];
  /** Denormalised slugs so cards can link without extra lookups. */
  categorySlugs: Slug[];
  tags: string[];
  /** Included file extensions, e.g. `["AI", "EPS", "PNG"]`. */
  fileTypes: string[];
  images: ProductImage[];
  attributes: ProductAttribute[];

  ratingAverage: number;
  ratingCount: number;
  salesCount: number;

  featured: boolean;
  bestseller: boolean;
  isNew: boolean;

  /** License codes available for this product. */
  licenses: LicenseCode[];
  vendor?: ProductVendor;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}
