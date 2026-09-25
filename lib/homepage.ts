/**
 * Homepage discovery content, mirroring the current Creative Hatti IA.
 * Data-driven: sections render from these lists, and every tile links to a
 * search query with real mock results. The backend will own this content
 * eventually — components already treat it as data, not markup.
 */

import { routes } from "@/lib/routes";

export interface DiscoveryTile {
  label: string;
  caption: string;
  /** Search query powering the tile. */
  query: string;
  hue: number;
  /**
   * Explicit listing URL. Tiles that map cleanly onto the taxonomy link to
   * category pages; the rest fall back to keyword search. Discovery stays a
   * separate layer — it is not forced to mirror taxonomy slugs.
   */
  href?: string;
}

/** Main discovery categories (distinct from the backend taxonomy). */
export const discoveryTiles: DiscoveryTile[] = [
  { label: "Logos", caption: "Marks, badges & monograms", query: "logo", hue: 212, href: routes.category("logo-design") },
  { label: "Banners", caption: "Promo & social banners", query: "banner", hue: 22 },
  { label: "Characters", caption: "Mythology to modern", query: "character", hue: 268, href: routes.category("character-bundle") },
  { label: "Bundles", caption: "Consistent packs", query: "bundle", hue: 152 },
  { label: "Websites", caption: "Heroes & web graphics", query: "website", hue: 200, href: routes.category("website") },
  { label: "Flyers", caption: "Local business flyers", query: "flyer", hue: 340, href: routes.category("flyers") },
  { label: "Freebies", caption: "Top-notch free assets", query: "freebie", hue: 130, href: routes.category("freebies") },
  { label: "Cards", caption: "Greetings & invites", query: "card", hue: 48 },
];

export interface CharacterCategory {
  name: string;
  blurb: string;
  /** Search query used to count mock products for this category. */
  query: string;
  hue: number;
}

export const characterCategories: CharacterCategory[] = [
  {
    name: "Mythology Character",
    blurb: "Gods, epics and divine poses from Indian mythology.",
    query: "mythology",
    hue: 268,
  },
  {
    name: "Profession Character",
    blurb: "Doctors, vendors and everyday Indian professions.",
    query: "profession",
    hue: 212,
  },
  {
    name: "Cultural Character",
    blurb: "Dancers, weddings and living traditions.",
    query: "cultural",
    hue: 12,
  },
  {
    name: "Festival Characters",
    blurb: "Garba nights, Janmashtami and festive figures.",
    query: "festival characters",
    hue: 48,
  },
];

/** Compact keyword discovery chips. */
export const trendingKeywords: string[] = [
  "Illustration",
  "Banner",
  "Indian Design",
  "Cartoon Character",
  "Vector",
  "Vector Illustration",
  "India",
  "Background",
  "Design",
  "Creative Design",
  "Vector Character",
  "Social Media",
];

/** Hero brand stats (brand claims, not mock counts). */
export const heroStats: Array<{ value: string; label: string }> = [
  { value: "44,000+", label: "Ready-to-use assets" },
  { value: "100+", label: "Festival collections" },
  { value: "Instant", label: "Download & licence" },
];
