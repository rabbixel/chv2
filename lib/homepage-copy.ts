export const homepageSectionDefaults = {
  popular_searches: { heading: "Popular Searches" },
  discovery: { eyebrow: "Start exploring", heading: "What are you creating today?", description: "Jump straight into the aisles of the Hatti — every tile opens a curated corner of the marketplace." },
  hatti_choice: { eyebrow: "Handpicked", heading: "Creative Hatti's Choice", description: "Creative Hatti's handpicked collection. Discover the perfect creative resource for your next project.", browse_label: "Browse bestsellers", browse_url: "/popular" },
  character_categories: { eyebrow: "Same character, every pose", heading: "Featured Character Categories", description: "Consistent characters in varied actions and poses — mythology, professions, culture and festivals." },
  popular_freebies: { eyebrow: "Free character illustrations", heading: "Popular Freebies", description: "Explore free character artwork loved by the Hatti community.", browse_label: "Browse all free downloads", browse_url: "/free-downloads" },
  featured_packs: { eyebrow: "Handpicked packs", heading: "Featured Graphics & Illustration Packs", description: "Festival-ready illustration packs, curated the Hatti way — themed, consistent and ready to ship." },
  seasonal_collections: { eyebrow: "Seasonal & topical", heading: "Collections for every celebration", description: "Diwali to Bollywood — topical shelves that refresh with the Indian festive calendar." },
  popular_themes: { heading: "Explore popular themes" },
  trusted_clients: { eyebrow: "Loved across India", heading: "We are trusted by", description: "Studios, brands and creators build with Creative Hatti assets every day.", browse_label: "View All Clients", browse_url: "/trusted-by" },
} as const;

export type HomepageSectionKey = keyof typeof homepageSectionDefaults;
export interface HomepageSectionCopy {
  visible: boolean;
  eyebrow?: string;
  heading?: string;
  description?: string;
  browse_label?: string;
  browse_url?: string;
}
export type HomepageCopy = Record<HomepageSectionKey, HomepageSectionCopy>;

export function resolveHomepageCopy(override?: Partial<Record<HomepageSectionKey, Record<string, { mode?: string; value?: string | boolean | null }>>>): HomepageCopy {
  return Object.fromEntries(Object.entries(homepageSectionDefaults).map(([key, defaults]) => {
    const section = override?.[key as HomepageSectionKey];
    const visible = section?.visible;
    const values: Record<string, string | boolean> = {
      visible: visible?.mode === "custom" ? visible.value === true : true,
    };
    for (const [field, fallback] of Object.entries(defaults)) {
      const item = section?.[field];
      values[field] = item?.mode === "custom" ? (typeof item.value === "string" ? item.value : "") : fallback;
    }
    return [key, values];
  })) as unknown as HomepageCopy;
}
