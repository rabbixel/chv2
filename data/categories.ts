import type { Category } from "@/lib/types";

/**
 * Marketplace taxonomy with Creative Hatti's Indian creative identity.
 * `productCount` mirrors the mock catalogue in `data/products.ts`; the real
 * backend will supply search-index counts.
 *
 * NOTE: these are backend taxonomy categories — distinct from the homepage
 * discovery tiles in `lib/homepage.ts` (Logos, Banners, Cards, …), which are
 * a separate discovery layer and link to search.
 */
export const categories: Category[] = [
  {
    id: "cat-characters",
    slug: "characters",
    name: "Characters",
    description: "Mythology, profession, cultural and festival characters.",
    parentId: null,
    productCount: 8,
    featured: true,
    sortOrder: 1,
  },
  {
    id: "cat-festival-events",
    slug: "festival-events",
    name: "Festival & Events",
    description: "Diwali, Navratri, Eid, Republic Day and every celebration.",
    parentId: null,
    productCount: 10,
    featured: true,
    sortOrder: 2,
  },
  {
    id: "cat-indian-vectors",
    slug: "indian-vectors",
    name: "Indian Vectors",
    description: "Desi motifs, ornaments, food, sport and street culture.",
    parentId: null,
    productCount: 4,
    featured: true,
    sortOrder: 3,
  },
  {
    id: "cat-illustrations",
    slug: "illustrations",
    name: "Illustrations",
    description: "Hand-crafted Indian scenes, spots and stories.",
    parentId: null,
    productCount: 4,
    featured: true,
    sortOrder: 4,
  },
  {
    id: "cat-bundles",
    slug: "bundles",
    name: "Bundles & Packs",
    description: "Consistent character and festival bundles that go together.",
    parentId: null,
    productCount: 3,
    featured: true,
    sortOrder: 5,
  },
  {
    id: "cat-social-media",
    slug: "social-media",
    name: "Social Media",
    description: "Festive posts, banners and channel-ready creative kits.",
    parentId: null,
    productCount: 3,
    featured: true,
    sortOrder: 6,
  },
  {
    id: "cat-logos",
    slug: "logos",
    name: "Logos",
    description: "Badges, marks and identity starters for Indian brands.",
    parentId: null,
    productCount: 2,
    featured: true,
    sortOrder: 7,
  },
  {
    id: "cat-freebies",
    slug: "freebies",
    name: "Freebies",
    description: "Top-notch free vectors, icons and colouring pages.",
    parentId: null,
    productCount: 2,
    featured: true,
    sortOrder: 8,
  },
  {
    id: "cat-banners-flyers",
    slug: "banners-flyers",
    name: "Banners & Flyers",
    description: "Promotional banners and flyers for local businesses.",
    parentId: null,
    productCount: 3,
    featured: false,
    sortOrder: 9,
  },
  {
    id: "cat-templates",
    slug: "templates",
    name: "Templates",
    description: "Menus, cards and website graphics that ship fast.",
    parentId: null,
    productCount: 2,
    featured: false,
    sortOrder: 10,
  },
  {
    id: "cat-backgrounds",
    slug: "backgrounds",
    name: "Backgrounds",
    description: "Festive splashes, silks and tactile desi surfaces.",
    parentId: null,
    productCount: 2,
    featured: false,
    sortOrder: 11,
  },
];
