import type {
  ID,
  ISODateString,
  LicenseCode,
  Product,
  Slug,
} from "@/lib/types";

/**
 * Mock catalogue seed (43 products) with Creative Hatti's Indian creative
 * identity: characters, festival creatives, desi vectors, bundles, banners,
 * logos, templates and freebies.
 *
 * A compact tuple table keeps this file small while exercising every product
 * surface: pricing (incl. freebies), sales, ratings, flags, file types and
 * tags. The mock services in `lib/services` read this module — in production
 * the same interfaces are backed by the real API, so components never change.
 */

type SeedRow = [
  slug: Slug,
  title: string,
  categorySlug: Slug,
  /** Base price in rupees (converted to paise). 0 = freebie. */
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
  // Characters (8)
  ["ramayana-gods-bundle", "Ramayana Gods Character Bundle", "characters", 999, null, 4.9, 1204, 8930, ["featured", "bestseller"], ["AI", "EPS", "PNG"], ["mythology", "character", "bundle", "ramayana", "gods"]],
  ["krishna-janmashtami-pack", "Krishna Janmashtami Character Pack", "characters", 649, null, 4.9, 876, 6120, ["featured"], ["AI", "PNG"], ["mythology", "janmashtami", "krishna", "festival-characters", "character"]],
  ["indian-professions-set", "Indian Professions Character Set — 48 Figures", "characters", 899, 1199, 4.8, 743, 5210, [], ["AI", "EPS", "SVG"], ["profession", "character", "doctor", "teacher", "worker"]],
  ["punjabi-folk-dancers", "Punjabi Folk Dancer Characters", "characters", 549, null, 4.8, 432, 2980, [], ["AI", "PNG"], ["cultural", "dance", "punjabi", "character"]],
  ["bharatanatyam-poses", "Bharatanatyam Dance Pose Collection", "characters", 599, null, 4.9, 387, 2640, ["isNew"], ["AI", "EPS"], ["cultural", "dance", "classical", "character"]],
  ["garba-dandiya-characters", "Garba & Dandiya Night Characters", "characters", 699, null, 4.9, 654, 4710, ["featured"], ["AI", "PNG"], ["festival-characters", "navratri", "garba", "dance", "character"]],
  ["indian-wedding-couple", "Indian Wedding Couple Characters", "characters", 749, null, 4.8, 521, 3870, [], ["AI", "PNG"], ["cultural", "wedding", "couple", "character"]],
  ["mumbai-street-characters", "Mumbai Street Characters Pack", "characters", 499, null, 4.7, 289, 1980, ["isNew"], ["AI", "SVG"], ["profession", "street", "mumbai", "character"]],
  // Festival & Events (10)
  ["maha-shivratri-pack", "Maha Shivratri Celebration Pack", "festival-events", 599, null, 4.9, 987, 7240, ["featured"], ["AI", "PSD", "PNG"], ["maha-shivratri", "shivratri", "festival", "banner", "card"]],
  ["vasant-panchami-kit", "Happy Vasant Panchami Template Kit", "festival-events", 499, 699, 4.8, 623, 4530, [], ["PSD", "AI"], ["vasant-panchami", "saraswati", "festival", "template", "banner"]],
  ["valentine-day-cards", "Valentine's Day Card Collection", "festival-events", 399, null, 4.7, 312, 2310, [], ["PSD", "AI"], ["valentine-day", "valentine", "cards", "love"]],
  ["grand-diwali-collection", "Grand Diwali Vector Collection", "festival-events", 999, 1299, 4.9, 2310, 15420, ["featured", "bestseller"], ["AI", "EPS", "PNG"], ["diwali", "festival", "diya", "lights", "bundle"]],
  ["eid-mubarak-cards", "Eid Mubarak Greeting Cards", "festival-events", 499, null, 4.8, 445, 3210, [], ["PSD", "AI"], ["eid", "eid-mubarak", "cards", "festival"]],
  ["independence-day-kit", "Independence Day Tricolour Kit", "festival-events", 549, null, 4.8, 567, 4120, [], ["AI", "PNG"], ["independence-day", "tricolour", "patriotic", "festival"]],
  ["dussehra-ramleela-pack", "Dussehra Ramleela Scene Pack", "festival-events", 649, null, 4.8, 298, 2140, ["isNew"], ["AI", "EPS"], ["dussehra", "ramleela", "ravana", "mythology", "festival"]],
  ["ganesh-chaturthi-clipart", "Ganesh Chaturthi Clipart Set", "festival-events", 749, null, 4.9, 1102, 7860, ["featured", "bestseller"], ["AI", "PNG"], ["ganesh-chaturthi", "ganesh", "ganpati", "mythology", "festival", "clipart"]],
  ["karva-chauth-kit", "Karva Chauth Celebration Kit", "festival-events", 449, null, 4.7, 234, 1780, [], ["PSD", "PNG"], ["karva-chauth", "festival", "cards"]],
  ["pongal-harvest-pack", "Pongal Harvest Festival Pack", "festival-events", 449, null, 4.8, 187, 1340, ["isNew"], ["AI", "PNG"], ["pongal", "harvest", "festival"]],
  // Bundles & Packs (3)
  ["republic-day-bundle", "Republic Day Patriotic Bundle", "bundles", 799, null, 4.9, 1543, 11230, ["featured", "bestseller"], ["AI", "PSD", "PNG"], ["republic-day", "patriotic", "tricolour", "bundle", "banner"]],
  ["navratri-nights-bundle", "Navratri Nights Design Bundle", "bundles", 899, 1099, 4.9, 876, 6230, ["featured"], ["AI", "EPS", "PNG"], ["navratri", "garba", "dandiya", "bundle", "festival", "festival-characters"]],
  ["diwali-social-bundle", "Diwali Social Media Bundle", "bundles", 799, null, 4.8, 689, 4980, [], ["PSD", "PNG"], ["diwali", "social-media", "instagram", "bundle"]],
  // Indian Vectors (4)
  ["street-food-vectors", "Indian Street Food Vector Set", "indian-vectors", 549, null, 4.8, 534, 3870, [], ["AI", "EPS"], ["vector", "food", "street", "chaat"]],
  ["desi-truck-art", "Desi Truck Art Motif Pack", "indian-vectors", 649, null, 4.9, 478, 3420, ["featured"], ["AI", "EPS"], ["vector", "truck-art", "ornament"]],
  ["paisley-mandala-library", "Paisley & Mandala Ornament Library", "indian-vectors", 599, 799, 4.9, 891, 6310, [], ["AI", "PAT"], ["vector", "paisley", "mandala", "ornament"]],
  ["cricket-fever-bundle", "Cricket Fever Vector Bundle", "indian-vectors", 699, null, 4.8, 612, 4450, [], ["AI", "PNG"], ["vector", "cricket", "sports", "bundle"]],
  // Illustrations (4)
  ["auto-rickshaw-pack", "Auto Rickshaw Illustration Pack", "illustrations", 499, null, 4.8, 356, 2640, [], ["AI", "SVG"], ["illustration", "transport", "rickshaw"]],
  ["spice-market-scenes", "Spice Market Scene Illustrations", "illustrations", 799, null, 4.9, 289, 1980, ["isNew"], ["AI", "EPS"], ["illustration", "scenes", "market"]],
  ["yoga-ayurveda-spots", "Yoga & Ayurveda Spot Illustrations", "illustrations", 599, null, 4.9, 743, 5320, ["bestseller"], ["AI", "SVG"], ["illustration", "yoga", "wellness", "ayurveda"]],
  ["big-fat-wedding-scenes", "Big Fat Indian Wedding Scenes", "illustrations", 999, null, 4.9, 678, 4890, ["featured"], ["AI", "EPS"], ["illustration", "wedding", "scenes"]],
  // Social Media (3)
  ["festive-instagram-kit", "Festive Instagram Banner Kit — 90 Posts", "social-media", 599, 799, 4.9, 2010, 14230, ["bestseller"], ["PSD", "CANVA"], ["social-media", "instagram", "banner", "festive"]],
  ["bollywood-night-kit", "Bollywood Movie Night Social Kit", "social-media", 649, null, 4.7, 298, 2140, ["isNew"], ["PSD", "PNG"], ["social-media", "bollywood", "banner"]],
  ["holi-party-social-pack", "Holi Party Social Media Pack", "social-media", 549, null, 4.8, 423, 3120, [], ["PSD", "PNG"], ["social-media", "holi", "instagram"]],
  // Logos (2)
  ["vintage-badge-logos", "Vintage Badge Logo Templates — 60 Marks", "logos", 899, null, 4.8, 689, 4720, [], ["AI", "EPS"], ["logo", "badge", "vintage"]],
  ["indian-startup-logos", "Indian Startup Logo Collection", "logos", 1099, 1399, 4.7, 345, 2340, [], ["AI", "EPS", "SVG"], ["logo", "startup", "business"]],
  // Banners & Flyers (3)
  ["salon-spa-flyers", "Salon & Spa Flyer Templates", "banners-flyers", 449, null, 4.7, 287, 2140, [], ["PSD"], ["flyer", "salon", "business"]],
  ["garba-night-flyer", "Garba Night DJ Flyer Templates", "banners-flyers", 399, 549, 4.8, 356, 2680, [], ["PSD"], ["flyer", "navratri", "garba"]],
  ["real-estate-banners", "Real Estate Banner Design Pack", "banners-flyers", 549, null, 4.6, 234, 1780, [], ["PSD", "AI"], ["banner", "real-estate", "business"]],
  // Templates (2)
  ["restaurant-menu-cards", "Restaurant Menu Card Pack", "templates", 499, null, 4.7, 345, 2560, [], ["PSD", "AI"], ["template", "menu", "card", "restaurant"]],
  ["website-hero-illustrations", "Website Hero Illustration Set", "templates", 1299, null, 4.8, 198, 1340, ["isNew"], ["AI", "SVG"], ["template", "website", "hero", "illustration"]],
  // Backgrounds (2)
  ["holi-splash-backgrounds", "Holi Colour Splash Backgrounds", "backgrounds", 449, null, 4.8, 512, 3780, [], ["JPG", "PNG"], ["background", "holi", "colours"]],
  ["banarasi-silk-textures", "Banarasi Silk Texture Bundle", "backgrounds", 799, null, 4.8, 267, 1890, [], ["JPG"], ["background", "silk", "texture"]],
  // Freebies (2)
  ["diya-lantern-icons-free", "Free Diya & Lantern Icon Set", "freebies", 0, null, 4.9, 1876, 21340, ["featured"], ["SVG", "PNG"], ["freebie", "diwali", "diya", "icons"]],
  ["mandala-colouring-free", "Free Mandala Colouring Pages", "freebies", 0, null, 4.8, 1243, 15680, [], ["PDF", "PNG"], ["freebie", "mandala", "colouring"]],
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
  // Slug-based IDs stay stable when rows are added or reordered.
  const id: ID = `prod-${slug}`;
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
    categoryIds: [`cat-${categorySlug}`],
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
