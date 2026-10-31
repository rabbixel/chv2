/** Shared sparse-override resolver for the WordPress-managed homepage config. */
export interface HomepageHeroImage<TImage> {
  mode: "default" | "custom";
  image?: TImage | null;
  href?: string;
}

export interface HomepageHeroStat {
  value: string;
  label: string;
  visible: boolean;
}

export interface HomepageHeroConfig<TImage> {
  enabled: boolean;
  showImages: boolean;
  eyebrow: string;
  heading: string;
  description: string;
  searchPlaceholder: string;
  searchButtonText: string;
  images: HomepageHeroImage<TImage>[];
  stats: HomepageHeroStat[];
}

export interface HomepageHeroOverride<TImage> {
  enabled?: { mode?: string; value?: boolean | null };
  show_images?: { mode?: string; value?: boolean | null };
  eyebrow?: { mode?: string; value?: string | null };
  heading?: { mode?: string; value?: string | null };
  description?: { mode?: string; value?: string | null };
  search_placeholder?: { mode?: string; value?: string | null };
  search_button_text?: { mode?: string; value?: string | null };
  images?: Array<{ mode?: string; image?: TImage | null; link_url?: string }>;
  stats?: Array<{ mode?: string; value?: string | null; label?: string | null; visible?: boolean }>;
}

const defaultHero = {
  eyebrow: "India's creative marketplace",
  heading: "The Ultimate Collection of Indian Vector Assets",
  description: "Characters, festival creatives, banners, bundles and ready-to-use templates — crafted with authentic Indian tadka for your next project.",
  searchPlaceholder: "What are you searching for today…",
  searchButtonText: "Search",
  stats: [
    { value: "44,000+", label: "Ready-to-use assets" },
    { value: "470+", label: "Freebies" },
    { value: "926+", label: "Bundles" },
  ],
};

function customValue<T>(field: { mode?: string; value?: T | null } | undefined, fallback: T): T {
  return field?.mode === "custom" ? (field.value ?? "" as T) : fallback;
}

/** Default values remain code-owned; explicit custom empty values are preserved. */
export function resolveHomepageHero<TImage>(override?: HomepageHeroOverride<TImage> | null): HomepageHeroConfig<TImage> {
  const images = Array.from({ length: 4 }, (_, index) => {
    const item = override?.images?.[index];
    if (item?.mode !== "custom") return { mode: "default" as const };
    return { mode: "custom" as const, image: item.image ?? null, href: item.link_url || undefined };
  });
  const stats = defaultHero.stats.map((fallback, index) => {
    const item = override?.stats?.[index];
    if (item?.mode !== "custom") return { ...fallback, visible: true };
    return { value: item.value ?? "", label: item.label ?? "", visible: item.visible !== false };
  });
  return {
    enabled: override?.enabled?.mode === "custom" ? override.enabled.value === true : true,
    showImages: override?.show_images?.mode === "custom" ? override.show_images.value === true : true,
    eyebrow: customValue(override?.eyebrow, defaultHero.eyebrow),
    heading: customValue(override?.heading, defaultHero.heading),
    description: customValue(override?.description, defaultHero.description),
    searchPlaceholder: customValue(override?.search_placeholder, defaultHero.searchPlaceholder),
    searchButtonText: customValue(override?.search_button_text, defaultHero.searchButtonText),
    images,
    stats,
  };
}
