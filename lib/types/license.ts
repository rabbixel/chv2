import type { ID } from "./common";

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
