import type { License } from "@/lib/types";

/** License tiers. Multipliers apply to the product base price. */
export const licenses: License[] = [
  {
    id: "lic-personal",
    code: "personal",
    name: "Personal",
    description:
      "For personal projects and gifts. Covers a single user and non-commercial end products.",
    priceMultiplier: 1,
    allowedUses: [
      "1 user",
      "Unlimited personal projects",
      "Social posts (non-commercial)",
    ],
    seats: 1,
  },
  {
    id: "lic-commercial",
    code: "commercial",
    name: "Commercial",
    description:
      "For freelancers and businesses. Covers one brand or client with commercial end products.",
    priceMultiplier: 2,
    allowedUses: [
      "1 brand or client",
      "Commercial end products",
      "Paid advertising up to 100k impressions",
    ],
    seats: 1,
  },
  {
    id: "lic-extended",
    code: "extended",
    name: "Extended",
    description:
      "For teams and high-volume use. Covers multiple brands with unlimited impressions and resale-adjacent goods.",
    priceMultiplier: 5,
    allowedUses: [
      "Up to 5 brands",
      "Unlimited impressions",
      "Merchandise & POD up to 10k units",
    ],
    seats: 5,
  },
];
