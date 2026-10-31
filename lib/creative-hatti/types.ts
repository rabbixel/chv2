export interface ChApiEnvelope<TData> {
  success: boolean;
  data: TData;
  pagination?: ChApiPagination;
}

export interface ChApiPagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ChApiProductAvailability {
  id: number;
  available: boolean;
  sold_out: boolean;
  remaining: number | null;
}

export interface ChApiProductAvailabilityBatch {
  items: ChApiProductAvailability[];
}

export interface ChApiSearchResult extends ChApiEnvelope<ChApiProductCard[]> {
  facets: import("@/lib/types").SearchFacet[];
  took_ms: number;
}

export interface ChApiMoney {
  type?: "single" | "variable";
  class?: "paid" | "free" | "mixed" | "invalid";
  valid?: boolean;
  amount: number | null;
  formatted?: string;
  currency: string;
}

export interface ChApiTerm {
  id: number;
  name: string;
  slug: string;
}

export interface ChApiImage {
  id: number;
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  source_file?: string | null;
  original_file?: string | null;
  original_url?: string | null;
  parent_id?: number | null;
}

export interface ChWpMediaDetails {
  width?: number;
  height?: number;
  file?: string;
  original_image?: string;
}

export interface ChWpMedia {
  id: number;
  source_url: string;
  post?: number | null;
  media_details?: ChWpMediaDetails;
}

export interface ChApiProductCard {
  id: number;
  title: string;
  slug: string;
  price: ChApiMoney;
  image?: ChApiImage | null;
  categories?: ChApiTerm[];
  featured?: boolean;
  file_type?: string | null;
  file_size?: string | null;
  availability?: { available: boolean; sold_out: boolean; remaining: number | null };
  /** SEO overrides can be included by detail and paginated sitemap feeds. */
  seo?: ChApiSeo;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
}

export interface ChApiVariablePrice {
  id?: number | string;
  name?: string;
  amount?: number | string | null;
  formatted?: string;
  currency?: string;
  default?: boolean;
}

export interface ChApiProductDetail extends ChApiProductCard {
  status?: string;
  date?: string;
  modified?: string;
  description?: string | null;
  short_description?: string | null;
  variable_prices?: ChApiVariablePrice[];
  featured_image?: ChApiImage | null;
  gallery?: ChApiImage[];
  tags?: ChApiTerm[];
  compatible_with?: string | null;
  documentation?: boolean | string | null;
  seo?: ChApiSeo;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
}

/** Yoast values exported by the WordPress API. Empty fields are omitted. */
export interface ChApiSeo {
  title?: string | null;
  description?: string | null;
  canonical_url?: string | null;
}

export interface ChApiCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  count?: number;
  parent?: number;
  image_url?: string;
  image?: ChApiImage | null;
  seo?: ChApiSeo;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
}

export interface ChApiSitemapProduct {
  slug: string;
  modified?: string;
  canonical_url?: string | null;
}

export interface ChApiSitemapBatch {
  total: number;
  items: ChApiSitemapProduct[];
}

export interface ChApiHomepageCharacter {
  id: string;
  name: string;
  blurb: string;
  query: string;
  category_slug: string;
  hue: number;
  artwork: string;
  count: number;
  image?: ChApiImage | null;
}

export interface ChApiHomepagePack {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  query: string;
  hue: number;
  kind: "festival" | "seasonal" | "topical";
  featured: true;
  sort_order: number;
  category_slug?: string;
  url?: string;
  image?: ChApiImage | null;
  artwork: string;
}

export interface ChApiHomepageSections {
  discovery_tiles?: ChApiHomepageTile[];
  seasonal_collections?: ChApiHomepageTile[];
  keywords?: string[];
  trusted_brands?: Array<{ id: number; name: string; image: ChApiImage }>;
  character_categories_enabled: boolean;
  featured_packs_enabled: boolean;
  character_categories: ChApiHomepageCharacter[];
  featured_packs: ChApiHomepagePack[];
  homepage_config_v2?: ChApiHomepageConfigV2;
}

export interface ChApiHomepageConfigV2 {
  version: 2;
  sections?: Record<string, Record<string, { mode: "default" | "custom"; value: string | boolean | null } | { mode: "automatic" | "manual"; product_ids: number[] }>>;
  hero: {
    enabled: { mode: "default" | "custom"; value: boolean | null };
    show_images?: { mode: "default" | "custom"; value: boolean | null };
    eyebrow: { mode: "default" | "custom"; value: string | null };
    heading: { mode: "default" | "custom"; value: string | null };
    description: { mode: "default" | "custom"; value: string | null };
    search_placeholder: { mode: "default" | "custom"; value: string | null };
    search_button_text: { mode: "default" | "custom"; value: string | null };
    images: Array<{ mode: "default" | "custom"; image: ChApiImage | null; link_url: string }>;
    stats: Array<{ mode: "default" | "custom"; value: string | null; label: string | null; visible: boolean }>;
  };
}

export interface ChApiHomepageTile {
  id: string;
  title: string;
  caption?: string;
  query: string;
  category_slug?: string;
  hue?: number;
  icon?: string;
  image?: ChApiImage | null;
  url?: string;
}
