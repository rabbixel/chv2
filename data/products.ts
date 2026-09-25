import type {
  ID,
  ISODateString,
  LicenseCode,
  Product,
  ProductGroupSlug,
  ProductKind,
  Slug,
} from "@/lib/types";

/**
 * Mock catalogue seed (52 products) on the real Creative Hatti taxonomy
 * (`lib/taxonomy.ts`): Vector Creatives, Character Bundle and Freebies.
 *
 * Tuple columns: slug, title, group, subcategory (null = group-level),
 * kind, price (₹), compare-at (₹|null), rating, ratingCount, sales, flags,
 * file types, tags. The mock services in `lib/services` read this module —
 * in production the same interfaces are backed by the real API.
 */

type SeedRow = [
  slug: Slug,
  title: string,
  group: ProductGroupSlug,
  sub: Slug | null,
  kind: ProductKind,
  priceInr: number,
  compareAtInr: number | null,
  ratingAverage: number,
  ratingCount: number,
  salesCount: number,
  flags: Array<"featured" | "bestseller" | "isNew">,
  fileTypes: string[],
  tags: string[],
];

const SEED: SeedRow[] = [
  // Character Bundle — Cultural (3)
  ["punjabi-folk-dancers", "Punjabi Folk Dancer Characters", "character-bundle", "cultural", "vector", 549, null, 4.8, 432, 2980, [], ["AI", "PNG"], ["cultural", "dance", "punjabi", "character"]],
  ["bharatanatyam-poses", "Bharatanatyam Dance Pose Collection", "character-bundle", "cultural", "vector", 599, null, 4.9, 387, 2640, ["isNew"], ["AI", "EPS"], ["cultural", "dance", "classical", "character"]],
  ["indian-wedding-couple", "Indian Wedding Couple Characters", "character-bundle", "cultural", "vector", 749, null, 4.8, 521, 3870, [], ["AI", "PNG"], ["cultural", "wedding", "couple", "character"]],
  // Character Bundle — Festival & Events (3)
  ["krishna-janmashtami-pack", "Krishna Janmashtami Character Pack", "character-bundle", "festival-events", "vector", 649, null, 4.9, 876, 6120, ["featured"], ["AI", "PNG"], ["mythology", "janmashtami", "krishna", "festival-characters", "character"]],
  ["garba-dandiya-characters", "Garba & Dandiya Night Characters", "character-bundle", "festival-events", "vector", 699, null, 4.9, 654, 4710, ["featured"], ["AI", "PNG"], ["festival-characters", "navratri", "garba", "dance", "character"]],
  ["navratri-nights-bundle", "Navratri Nights Design Bundle", "character-bundle", "festival-events", "bundle", 899, 1099, 4.9, 876, 6230, ["featured"], ["AI", "EPS", "PNG"], ["navratri", "garba", "dandiya", "bundle", "festival", "festival-characters"]],
  // Character Bundle — Mythological (4)
  ["ramayana-gods-bundle", "Ramayana Gods Character Bundle", "character-bundle", "mythological", "bundle", 999, null, 4.9, 1204, 8930, ["featured", "bestseller"], ["AI", "EPS", "PNG"], ["mythology", "character", "bundle", "ramayana", "gods"]],
  ["ganesh-character-bundle", "Ganesh Chaturthi Character Bundle", "character-bundle", "mythological", "bundle", 849, null, 4.9, 689, 4980, ["featured"], ["AI", "PNG"], ["mythology", "character", "bundle", "ganesh", "festival"]],
  ["hanuman-character-bundle", "Hanuman Pawanputra Character Bundle", "character-bundle", "mythological", "bundle", 899, null, 4.9, 743, 5320, ["featured"], ["AI", "PNG"], ["mythology", "character", "bundle", "hanuman"]],
  ["lakshmi-mata-bundle", "Lakshmi Mata Festival Bundle", "character-bundle", "mythological", "bundle", 749, null, 4.8, 423, 3120, [], ["AI", "PNG"], ["mythology", "character", "bundle", "lakshmi", "diwali"]],
  // Character Bundle — People (2)
  ["mumbai-street-characters", "Mumbai Street Characters Pack", "character-bundle", "people", "vector", 499, null, 4.7, 289, 1980, ["isNew"], ["AI", "SVG"], ["profession", "street", "mumbai", "character", "people"]],
  ["indian-kids-characters", "Indian Kids Character Pack", "character-bundle", "people", "vector", 449, null, 4.8, 289, 2140, ["isNew"], ["AI", "SVG"], ["people", "kids", "character"]],
  // Character Bundle — Profession (3)
  ["indian-professions-set", "Indian Professions Character Set — 48 Figures", "character-bundle", "profession", "vector", 899, 1199, 4.8, 743, 5210, [], ["AI", "EPS", "SVG"], ["profession", "character", "doctor", "teacher", "worker"]],
  ["doctor-character-illustration", "Doctor Character Illustration Set", "character-bundle", "profession", "vector", 599, null, 4.8, 356, 2670, [], ["AI", "SVG"], ["profession", "doctor", "character", "medical"]],
  ["indian-farmer-character", "Indian Farmer Character Pack", "character-bundle", "profession", "vector", 549, null, 4.8, 298, 2310, [], ["AI", "PNG"], ["profession", "farmer", "character", "village"]],
  // Character Bundle — Miscellaneous (1)
  ["cricket-fan-characters", "Cricket Fan Characters", "character-bundle", "miscellaneous", "vector", 399, null, 4.7, 234, 1780, [], ["AI", "PNG"], ["character", "cricket", "sports", "fans"]],
  // Vector Creatives — Flyers (3)
  ["garba-night-flyer", "Garba Night DJ Flyer Templates", "vector-creatives", "flyers", "vector", 399, 549, 4.8, 356, 2680, [], ["PSD"], ["flyer", "navratri", "garba"]],
  ["salon-spa-flyers", "Salon & Spa Flyer Templates", "vector-creatives", "flyers", "vector", 449, null, 4.7, 287, 2140, [], ["PSD"], ["flyer", "salon", "business"]],
  ["dhaba-grand-opening-flyer", "Dhaba Grand Opening Flyer Pack", "vector-creatives", "flyers", "vector", 449, null, 4.7, 198, 1450, [], ["PSD"], ["flyer", "dhaba", "restaurant", "food"]],
  // Vector Creatives — Logo Design (3)
  ["logo-template-collection", "Logo Template Collection — 80 Marks", "vector-creatives", "logo-design", "vector", 899, 1199, 4.8, 723, 5120, [], ["AI", "EPS", "SVG"], ["logo", "template", "badge", "business"]],
  ["indian-startup-logos", "Indian Startup Logo Collection", "vector-creatives", "logo-design", "vector", 1099, 1399, 4.7, 345, 2340, [], ["AI", "EPS", "SVG"], ["logo", "startup", "business"]],
  ["wedding-monogram-logos", "Wedding Monogram Logo Pack", "vector-creatives", "logo-design", "vector", 649, null, 4.8, 312, 2340, ["isNew"], ["AI", "EPS"], ["logo", "monogram", "wedding"]],
  // Vector Creatives — Social Media (6)
  ["business-growth-banner", "Business Growth Banner Vector", "vector-creatives", "social-media", "vector", 549, null, 4.7, 289, 2140, [], ["AI", "PSD"], ["banner", "business", "growth", "marketing"]],
  ["indian-festival-banner", "Indian Festival Banner Pack", "vector-creatives", "social-media", "vector", 499, 699, 4.8, 534, 3980, [], ["AI", "PSD", "PNG"], ["banner", "festival", "diwali", "navratri"]],
  ["social-media-marketing-creative", "Social Media Marketing Creative Kit", "vector-creatives", "social-media", "vector", 599, null, 4.7, 345, 2670, ["isNew"], ["PSD", "CANVA"], ["social-media", "marketing", "instagram", "business"]],
  ["festive-instagram-kit", "Festive Instagram Banner Kit — 90 Posts", "vector-creatives", "social-media", "vector", 599, 799, 4.9, 2010, 14230, ["bestseller"], ["PSD", "CANVA"], ["social-media", "instagram", "banner", "festive"]],
  ["bollywood-night-kit", "Bollywood Movie Night Social Kit", "vector-creatives", "social-media", "vector", 649, null, 4.7, 298, 2140, ["isNew"], ["PSD", "PNG"], ["social-media", "bollywood", "banner"]],
  ["holi-party-social-pack", "Holi Party Social Media Pack", "vector-creatives", "social-media", "vector", 549, null, 4.8, 423, 3120, [], ["PSD", "PNG"], ["social-media", "holi", "instagram"]],
  // Vector Creatives — Website (2)
  ["website-hero-illustrations", "Website Hero Illustration Set", "vector-creatives", "website", "vector", 1299, null, 4.8, 198, 1340, ["isNew"], ["AI", "SVG"], ["template", "website", "hero", "illustration"]],
  ["ayurveda-website-kit", "Ayurveda Spa Website Graphics", "vector-creatives", "website", "vector", 1099, null, 4.8, 156, 1120, ["isNew"], ["AI", "SVG"], ["website", "ayurveda", "spa", "hero"]],
  // Vector Creatives — T-Shirts (2)
  ["desi-swag-tshirt", "Desi Swag T-Shirt Graphics", "vector-creatives", "t-shirts", "vector", 499, null, 4.8, 423, 3120, [], ["AI", "PNG"], ["t-shirt", "desi", "quotes", "print"]],
  ["yoga-day-tee", "Yoga Day T-Shirt Print Pack", "vector-creatives", "t-shirts", "vector", 399, null, 4.7, 267, 1980, [], ["AI", "PNG"], ["t-shirt", "yoga", "print"]],
  // Vector Creatives — group-level festival & desi assets (18)
  ["maha-shivratri-pack", "Maha Shivratri Celebration Pack", "vector-creatives", null, "vector", 599, null, 4.9, 987, 7240, ["featured"], ["AI", "PSD", "PNG"], ["maha-shivratri", "shivratri", "festival", "banner", "card"]],
  ["vasant-panchami-kit", "Happy Vasant Panchami Template Kit", "vector-creatives", null, "vector", 499, 699, 4.8, 623, 4530, [], ["PSD", "AI"], ["vasant-panchami", "saraswati", "festival", "template", "banner"]],
  ["valentine-day-cards", "Valentine's Day Card Collection", "vector-creatives", null, "vector", 399, null, 4.7, 312, 2310, [], ["PSD", "AI"], ["valentine-day", "valentine", "cards", "love"]],
  ["grand-diwali-collection", "Grand Diwali Vector Collection", "vector-creatives", null, "vector", 999, 1299, 4.9, 2310, 15420, ["featured", "bestseller"], ["AI", "EPS", "PNG"], ["diwali", "festival", "diya", "lights", "bundle"]],
  ["eid-mubarak-cards", "Eid Mubarak Greeting Cards", "vector-creatives", null, "vector", 499, null, 4.8, 445, 3210, [], ["PSD", "AI"], ["eid", "eid-mubarak", "cards", "festival"]],
  ["independence-day-kit", "Independence Day Tricolour Kit", "vector-creatives", null, "vector", 549, null, 4.8, 567, 4120, [], ["AI", "PNG"], ["independence-day", "tricolour", "patriotic", "festival"]],
  ["dussehra-ramleela-pack", "Dussehra Ramleela Scene Pack", "vector-creatives", null, "vector", 649, null, 4.8, 298, 2140, ["isNew"], ["AI", "EPS"], ["dussehra", "ramleela", "ravana", "mythology", "festival"]],
  ["ganesh-chaturthi-clipart", "Ganesh Chaturthi Clipart Set", "vector-creatives", null, "vector", 749, null, 4.9, 1102, 7860, ["featured", "bestseller"], ["AI", "PNG"], ["ganesh-chaturthi", "ganesh", "ganpati", "mythology", "festival", "clipart"]],
  ["karva-chauth-kit", "Karva Chauth Celebration Kit", "vector-creatives", null, "vector", 449, null, 4.7, 234, 1780, [], ["PSD", "PNG"], ["karva-chauth", "festival", "cards"]],
  ["pongal-harvest-pack", "Pongal Harvest Festival Pack", "vector-creatives", null, "vector", 449, null, 4.8, 187, 1340, ["isNew"], ["AI", "PNG"], ["pongal", "harvest", "festival"]],
  ["desi-truck-art", "Desi Truck Art Motif Pack", "vector-creatives", null, "vector", 649, null, 4.9, 478, 3420, ["featured"], ["AI", "EPS"], ["vector", "truck-art", "ornament"]],
  ["paisley-mandala-library", "Paisley & Mandala Ornament Library", "vector-creatives", null, "vector", 599, 799, 4.9, 891, 6310, [], ["AI", "PAT"], ["vector", "paisley", "mandala", "ornament"]],
  ["yoga-ayurveda-spots", "Yoga & Ayurveda Spot Illustrations", "vector-creatives", null, "vector", 599, null, 4.9, 743, 5320, ["bestseller"], ["AI", "SVG"], ["illustration", "yoga", "wellness", "ayurveda"]],
  ["big-fat-wedding-scenes", "Big Fat Indian Wedding Scenes", "vector-creatives", null, "vector", 999, null, 4.9, 678, 4890, ["featured"], ["AI", "EPS"], ["illustration", "wedding", "scenes"]],
  ["cricket-fever-bundle", "Cricket Fever Vector Bundle", "vector-creatives", null, "bundle", 699, null, 4.8, 612, 4450, [], ["AI", "PNG"], ["vector", "cricket", "sports", "bundle"]],
  ["real-estate-banners", "Real Estate Banner Design Pack", "vector-creatives", null, "vector", 549, null, 4.6, 234, 1780, [], ["PSD", "AI"], ["banner", "real-estate", "business"]],
  ["diwali-social-bundle", "Diwali Social Media Bundle", "vector-creatives", null, "bundle", 799, null, 4.8, 689, 4980, [], ["PSD", "PNG"], ["diwali", "social-media", "instagram", "bundle"]],
  ["indian-wedding-invitation", "Indian Wedding Invitation Suite", "vector-creatives", null, "vector", 899, null, 4.9, 876, 6340, [], ["PSD", "AI"], ["wedding", "invitation", "card", "stationery"]],
  // Freebies (2)
  ["diya-lantern-icons-free", "Free Diya & Lantern Icon Set", "freebies", null, "freebie", 0, null, 4.9, 1876, 21340, ["featured"], ["SVG", "PNG"], ["freebie", "diwali", "diya", "icons"]],
  ["mandala-colouring-free", "Free Mandala Colouring Pages", "freebies", null, "freebie", 0, null, 4.8, 1243, 15680, [], ["PDF", "PNG"], ["freebie", "mandala", "colouring"]],
];

const DEFAULT_LICENSES: LicenseCode[] = ["personal", "commercial", "extended"];

/** Editable-template signals: logos, flyers, banners, templates. */
const CUSTOMIZABLE_SUBS: Slug[] = ["logo-design", "flyers", "social-media", "website"];
const CUSTOMIZABLE_TAGS = ["template", "logo", "flyer", "banner", "menu", "card", "monogram"];

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

function compatibleWith(fileTypes: string[]): string[] {
  const apps = new Set<string>();
  for (const type of fileTypes) {
    switch (type) {
      case "AI":
      case "EPS":
        apps.add("Adobe Illustrator CC+");
        break;
      case "PSD":
      case "PAT":
        apps.add("Adobe Photoshop CC+");
        break;
      case "SVG":
      case "FIG":
        apps.add("Figma & Sketch");
        break;
      case "CANVA":
        apps.add("Canva");
        break;
      case "PPTX":
        apps.add("PowerPoint & Keynote");
        break;
      case "DOCX":
      case "PDF":
        apps.add("Any PDF reader");
        break;
      default:
        break;
    }
  }
  if (apps.size === 0) apps.add("Any image editor");
  return [...apps];
}

function toProduct(row: SeedRow, index: number): Product {
  const [
    slug,
    title,
    group,
    sub,
    kind,
    priceInr,
    compareAtInr,
    ratingAverage,
    ratingCount,
    salesCount,
    flags,
    fileTypes,
    tags,
  ] = row;
  // Slug-based IDs stay stable when rows are added or reordered.
  const id: ID = `prod-${slug}`;
  const categorySlugs = sub ? [sub, group] : [group];
  const isFree = priceInr === 0;
  const isSale = compareAtInr !== null && compareAtInr > priceInr;
  return {
    id,
    slug,
    title,
    shortDescription: `${title} — a curated Creative Hatti asset.`,
    description: `${title} is part of the Creative Hatti curated collection of Indian creative assets. Mock description until editorial content lands.`,
    price: { amount: priceInr * 100, currency: "INR" },
    compareAtPrice:
      compareAtInr === null
        ? undefined
        : { amount: compareAtInr * 100, currency: "INR" },
    status: "active",
    productGroup: group,
    kind,
    categoryIds: categorySlugs.map((value) => `cat-${value}`),
    categorySlugs,
    tags,
    keywords: [
      ...new Set(
        [group, sub, ...tags, "indian", "vector", "download"].filter(
          (entry): entry is string => Boolean(entry),
        ),
      ),
    ].slice(0, 14),
    fileTypes,
    fileIncluded: [
      ...fileTypes.map((type) => `${type} source files`),
      "High-res JPG previews",
      "Help guide (PDF)",
    ],
    // Deterministic 12–372 MB mock file size.
    fileSizeBytes: (12 + hueForSlug(slug)) * 1_000_000,
    compatibleWith: compatibleWith(fileTypes),
    documentationUrl: "/help",
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
    isFree,
    isFeatured: flags.includes("featured"),
    isSale,
    isCustomizable:
      (sub !== null && CUSTOMIZABLE_SUBS.includes(sub)) ||
      tags.some((tag) => CUSTOMIZABLE_TAGS.includes(tag)),
    licenses: DEFAULT_LICENSES,
    createdAt: daysAgo(300 - index * 5),
    updatedAt: daysAgo(index * 2),
  };
}

export const products: Product[] = SEED.map(toProduct);
