import type { ID, ISODateString, Slug } from "./common";

/** License tiers offered on digital products. */
export type LicenseCode = "personal" | "commercial" | "extended";

export interface License {
  id: ID;
  code: LicenseCode;
  name: string;
  description: string;
  /** Multiplier applied to the base price, e.g. `1`, `2`, `5`. */
  priceMultiplier: number;
  /** Short list of permitted uses shown on the product page. */
  allowedUses: string[];
  seats: number;
}

/** License key owned by the customer (issued per paid order line). */
export type OwnedLicenseStatus = "active" | "revoked" | "expired";

export interface OwnedLicense {
  id: ID;
  /** Opaque key issued by the backend; shown verbatim, never parsed. */
  key: string;
  productId: ID;
  productSlug: Slug;
  productTitle: string;
  orderId: ID;
  orderNumber: string;
  license: LicenseCode;
  status: OwnedLicenseStatus;
  issuedAt: ISODateString;
  /** Only when the backend supplies an expiry (field hidden otherwise). */
  expiresAt?: ISODateString;
  /** Only when the backend tracks activations (hidden otherwise). */
  activationsUsed?: number;
  activationsLimit?: number;
}
