import type {
  ID,
  ISODateString,
  LicenseCode,
  Product,
  Slug,
} from "@/lib/types";

/**
 * Mock catalogue seed (32 products).
 *
 * A compact tuple table keeps this file small while exercising every product
 * surface: pricing, sales, ratings, flags, file types and tags. The mock
 * services in `lib/services` read this module — in production the same
 * interfaces are backed by the real API, so components never change.
 */

type SeedRow = [
  slug: Slug,
  title: string,
  categorySlug: Slug,
  /** Base price in rupees (converted to paise). */
  priceInr: number,
  /** Compare-at price in rupees, or null. */
  compareAtInr: number | null,
  ratingAverage: number,
  ratingCount: number,
  salesCount: number,
  flags: Array<"featured" | "bestseller" | "isNew">,
  fileTypes: string[],
  tags: string[],
];

const SEED: SeedRow[] = [
  ["marigold-display-family", "Marigold Display Family", "fonts", 1299, null, 4.9, 842, 5210, ["bestseller"], ["OTF", "TTF", "WOFF"], ["display", "serif", "headlines"]],
  ["jaipur-script-pro", "Jaipur Script Pro", "fonts", 899, 1299, 4.8, 1204, 8930, ["bestseller"], ["OTF", "WOFF"], ["script", "wedding", "invitations"]],
  ["ledger-grotesk", "Ledger Grotesk — 9 Weights", "fonts", 1599, null, 4.7, 356, 1980, ["isNew"], ["OTF", "WOFF2"], ["sans", "grotesque", "ui"]],
  ["diwali-pattern-pack", "Hand-Drawn Diwali Pattern Pack", "graphics", 499, 799, 4.9, 2310, 15420, ["featured", "bestseller"], ["AI", "EPS", "PNG"], ["diwali", "festive", "patterns"]],
  ["botanical-line-florals", "Botanical Line Florals — 120 Motifs", "graphics", 649, null, 4.8, 987, 6420, [], ["AI", "EPS", "SVG"], ["floral", "line-art", "wedding"]],
  ["mughal-arch-frames", "Mughal Arch Frames & Borders", "graphics", 549, null, 4.9, 764, 5120, ["featured"], ["AI", "PNG"], ["frames", "borders", "heritage"]],
  ["devanagari-brush-set", "Devanagari Calligraphy Brush Set", "graphics", 549, null, 4.8, 289, 1870, ["isNew"], ["ABR", "PNG"], ["calligraphy", "brushes", "lettering"]],
  ["folk-art-coloring-pages", "Indian Folk Art Colouring Pages", "graphics", 299, 399, 4.9, 732, 5210, [], ["PDF", "PNG"], ["kids", "colouring", "folk"]],
  ["india-street-scenes", "India Street Scenes — 40 Illustrations", "illustrations", 999, null, 4.8, 432, 2310, ["isNew"], ["AI", "EPS", "PNG"], ["editorial", "travel", "scenes"]],
  ["festival-character-pack", "Festival Character Pack", "illustrations", 749, 999, 4.7, 518, 3120, [], ["AI", "SVG", "PNG"], ["characters", "festive", "flat"]],
  ["yoga-wellness-spots", "Yoga & Wellness Spot Illustrations", "illustrations", 599, null, 4.9, 891, 5870, ["bestseller"], ["AI", "SVG"], ["wellness", "yoga", "spot"]],
  ["royal-wedding-suite", "Royal Wedding Invitation Suite", "templates", 899, null, 4.9, 1876, 12480, ["featured", "bestseller"], ["PSD", "AI"], ["wedding", "invitation", "stationery"]],
  ["restaurant-menu-pack", "Restaurant Menu Template Pack", "templates", 449, null, 4.6, 234, 1420, [], ["PSD", "AI"], ["menu", "restaurant", "print"]],
  ["minimal-portfolio-deck", "Minimal Portfolio Deck — 60 Slides", "templates", 699, 899, 4.7, 445, 2890, [], ["PPTX", "KEY"], ["slides", "portfolio", "deck"]],
  ["executive-resume-templates", "Executive Resume Templates", "templates", 299, null, 4.6, 521, 4120, [], ["DOCX", "PSD"], ["resume", "cv", "career"]],
  ["block-print-seamless", "Block Print Seamless Patterns", "patterns", 549, null, 4.9, 1120, 7840, ["featured"], ["AI", "PAT", "PNG"], ["seamless", "block-print", "textile"]],
  ["raw-silk-textures", "Raw Silk Texture Bundle", "patterns", 799, null, 4.8, 367, 2140, ["isNew"], ["JPG"], ["silk", "fabric", "backgrounds"]],
  ["film-grain-noise", "Film Grain & Noise Textures", "patterns", 399, null, 4.7, 445, 2980, [], ["JPG", "PNG"], ["grain", "overlay", "photography"]],
  ["kraft-packaging-mockups", "Kraft Packaging Mockup Set", "mockups", 649, 849, 4.8, 623, 3980, [], ["PSD"], ["packaging", "kraft", "branding"]],
  ["canvas-tote-mockups", "Canvas Tote Bag Mockups", "mockups", 399, null, 4.7, 289, 1730, [], ["PSD"], ["tote", "apparel", "merch"]],
  ["essentials-icon-duo", "Essentials Icon Duo — 1200 Icons", "icons", 799, null, 4.9, 1543, 9860, ["bestseller"], ["SVG", "FIG"], ["icons", "ui", "duotone"]],
  ["diwali-sticker-icons", "Diwali Sticker Icon Set", "icons", 299, null, 4.8, 456, 3210, ["isNew"], ["SVG", "PNG"], ["stickers", "diwali", "icons"]],
  ["fintech-dashboard-ui", "Fintech Dashboard UI Kit", "ui-kits", 1899, 2499, 4.7, 234, 1240, [], ["FIG"], ["dashboard", "fintech", "web"]],
  ["edtech-mobile-ui", "EdTech Mobile UI Kit", "ui-kits", 1499, null, 4.8, 178, 960, ["isNew"], ["FIG"], ["mobile", "education", "app"]],
  ["festive-instagram-pack", "Festive Instagram Pack — 90 Posts", "social-media", 599, 799, 4.9, 2010, 14230, ["bestseller"], ["PSD", "CANVA"], ["instagram", "social", "festive"]],
  ["youtube-starter-kit", "YouTube Starter Kit", "social-media", 499, null, 4.6, 312, 1890, [], ["PSD", "PNG"], ["youtube", "banners", "thumbnails"]],
  ["mehendi-invitation-cards", "Mehendi Invitation Cards", "wedding", 649, null, 4.9, 876, 6230, ["featured"], ["PSD", "AI"], ["mehendi", "invitation", "cards"]],
  ["sangeet-night-suite", "Sangeet Night Stationery Suite", "wedding", 799, 999, 4.8, 543, 3870, [], ["PSD", "AI"], ["sangeet", "stationery", "night"]],
  ["artisan-logo-collection", "Artisan Logo Collection — 60 Marks", "logos", 1099, null, 4.8, 689, 4120, [], ["AI", "EPS", "SVG"], ["logos", "marks", "identity"]],
  ["monogram-maker-kit", "Monogram Maker Kit", "logos", 899, 1199, 4.7, 378, 2340, [], ["AI", "PSD"], ["monogram", "letters", "branding"]],
  ["luxe-business-cards", "Luxe Business Card Set", "print-stationery", 349, null, 4.7, 267, 1890, [], ["PSD"], ["business-cards", "print", "minimal"]],
  ["elegant-certificate-pack", "Elegant Certificate Pack", "print-stationery", 449, 599, 4.8, 198, 1340, [], ["PSD", "DOCX"], ["certificates", "awards", "print"]],
];

const DEFAULT_LICENSES: LicenseCode[] = ["personal", "commercial", "extended"];

/** Deterministic hue (0–360) derived from a slug for placeholder art. */
export function hueForSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) % 360;
  }
  return hash;
}

/** Deterministic ISO date N days before a fixed anchor (stable builds). */
function daysAgo(days: number): ISODateString {
  const anchor = Date.UTC(2026, 8, 24, 6, 0, 0);
  return new Date(anchor - days * 86_400_000).toISOString();
}

function toProduct(row: SeedRow, index: number): Product {
  const [
    slug,
    title,
    categorySlug,
    priceInr,
    compareAtInr,
    ratingAverage,
    ratingCount,
    salesCount,
    flags,
    fileTypes,
    tags,
  ] = row;
  const id: ID = `prod-${String(index + 1).padStart(3, "0")}`;
  return {
    id,
    slug,
    title,
    shortDescription: `${title} — a curated Creative Hatti asset.`,
    description: `${title} is part of the Creative Hatti curated collection. Mock description until editorial content lands.`,
    price: { amount: priceInr * 100, currency: "INR" },
    compareAtPrice:
      compareAtInr === null
        ? undefined
        : { amount: compareAtInr * 100, currency: "INR" },
    status: "active",
    categoryIds: [`cat-${categorySlug.replace(/-/g, "")}`],
    categorySlugs: [categorySlug],
    tags,
    fileTypes,
    images: [
      {
        id: `${id}-img-1`,
        url: "",
        alt: title,
        placeholder: {
          hue: hueForSlug(slug),
          label: title
            .split(" ")
            .slice(0, 2)
            .map((word) => word.charAt(0))
            .join(""),
        },
      },
    ],
    attributes: [
      { name: "Files included", value: fileTypes.join(", ") },
      { name: "Licence options", value: "Personal · Commercial · Extended" },
    ],
    ratingAverage,
    ratingCount,
    salesCount,
    featured: flags.includes("featured"),
    bestseller: flags.includes("bestseller"),
    isNew: flags.includes("isNew"),
    licenses: DEFAULT_LICENSES,
    createdAt: daysAgo(300 - index * 7),
    updatedAt: daysAgo(index * 3),
  };
}

export const products: Product[] = SEED.map(toProduct);
