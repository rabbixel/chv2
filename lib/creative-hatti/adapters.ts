import type {
  Category,
  Paginated,
  Pagination,
  Product,
  ProductGroupSlug,
  ProductImage,
  ProductKind,
  Slug,
} from "@/lib/types";
import { normalizeWordPressMediaUrl } from "./media";
import { decodeHtmlEntities } from "./html";
import type {
  ChApiCategory,
  ChApiEnvelope,
  ChApiImage,
  ChApiPagination,
  ChApiProductCard,
  ChApiProductDetail,
  ChApiTerm,
} from "./types";

const API_TO_FRONTEND_CATEGORY: Record<string, string> = {
  "character-bundles": "character-bundle",
  "miscellaneous-character-bundles": "miscellaneous",
  // WordPress has a second "Miscellaneous" term under Freebies. Keep its
  // storefront slug distinct from the Character Bundle subcategory.
  miscellaneous: "freebies-miscellaneous",
};

const FRONTEND_TO_API_CATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(API_TO_FRONTEND_CATEGORY).map(([api, frontend]) => [
    frontend,
    api,
  ]),
);

const GROUPS: ProductGroupSlug[] = [
  "vector-creatives",
  "character-bundle",
  "freebies",
];

const GROUP_CHILDREN: Record<ProductGroupSlug, string[]> = {
  "vector-creatives": [
    "flyers",
    "logo-design",
    "social-media",
    "website",
    "t-shirts",
  ],
  "character-bundle": [
    "cultural",
    "festival-events",
    "mythological",
    "people",
    "profession",
    "miscellaneous",
  ],
  freebies: [],
};

export function apiCategorySlug(slug: string): string {
  return FRONTEND_TO_API_CATEGORY[slug] ?? slug;
}

export function frontendCategorySlug(slug: string): string {
  return API_TO_FRONTEND_CATEGORY[slug] ?? slug;
}

function groupFromCategories(slugs: string[]): ProductGroupSlug {
  for (const slug of slugs) {
    if ((GROUPS as string[]).includes(slug)) return slug as ProductGroupSlug;
  }
  for (const group of GROUPS) {
    if (slugs.some((slug) => GROUP_CHILDREN[group].includes(slug))) {
      return group;
    }
  }
  return "vector-creatives";
}

function productKind(product: ChApiProductCard, group: ProductGroupSlug): ProductKind {
  if (product.price.amount === 0 || group === "freebies") return "freebie";
  if (group === "character-bundle") return "bundle";
  return "vector";
}

function splitList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.toUpperCase());
}

function parseFileSize(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.trim().match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
  if (!match) return undefined;
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  const unit = match[2].toUpperCase();
  const multiplier =
    unit === "GB" ? 1024 ** 3 : unit === "MB" ? 1024 ** 2 : unit === "KB" ? 1024 : 1;
  return Math.round(amount * multiplier);
}

function moneyAmount(amount: number): number {
  return Math.round(amount * 100);
}

function imageFromApi(image: ChApiImage | null | undefined): ProductImage | null {
  if (!image?.url) return null;
  return {
    id: String(image.id),
    url: normalizeWordPressMediaUrl(image.original_url ?? image.url),
    alt: image.alt ?? "",
    width: image.width,
    height: image.height,
    sourceFile: image.source_file ?? undefined,
    originalFile: image.original_file ?? undefined,
    originalUrl: image.original_url
      ? normalizeWordPressMediaUrl(image.original_url)
      : undefined,
    parentId: image.parent_id === null || image.parent_id === undefined
      ? undefined
      : String(image.parent_id),
  };
}

function stripHtml(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const stripped = value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || undefined;
}

export function seoFromApi(value: {
  seo?: { title?: string | null; description?: string | null; canonical_url?: string | null };
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
}): Product["seo"] {
  const title = value.seo?.title ?? value.meta_title;
  const description = value.seo?.description ?? value.meta_description;
  const canonicalUrl = value.seo?.canonical_url ?? value.canonical_url;
  const seo = {
    ...(title?.trim() ? { title: decodeHtmlEntities(title.trim()) } : {}),
    ...(description?.trim() ? { description: decodeHtmlEntities(description.trim()) } : {}),
    ...(canonicalUrl?.trim() ? { canonicalUrl: canonicalUrl.trim() } : {}),
  };
  return Object.keys(seo).length ? seo : undefined;
}

function categorySlugs(categories: ChApiTerm[] | undefined): Slug[] {
  const slugs = (categories ?? []).map((category) =>
    frontendCategorySlug(category.slug),
  );
  const group = groupFromCategories(slugs);
  const specific = slugs.filter((slug) => slug !== group);
  return Array.from(new Set([...specific, group]));
}

export function paginationFromApi(pagination?: ChApiPagination): Pagination {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.per_page ?? 24;
  const totalItems = pagination?.total ?? 0;
  const totalPages = Math.max(1, pagination?.total_pages ?? 1);
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export function paginatedFromApi<TApi, TItem>(
  envelope: ChApiEnvelope<TApi[]>,
  mapItem: (item: TApi) => TItem,
): Paginated<TItem> {
  return {
    items: envelope.data.map(mapItem),
    pagination: paginationFromApi(envelope.pagination),
  };
}

export function productFromApi(apiProduct: ChApiProductDetail | ChApiProductCard): Product {
  const detail = apiProduct as ChApiProductDetail;
  const slugs = categorySlugs(apiProduct.categories);
  const group = groupFromCategories(slugs);
  const featured = Boolean(apiProduct.featured);
  const images = [
    imageFromApi(detail.featured_image ?? apiProduct.image),
    ...(detail.gallery ?? []).map(imageFromApi),
  ].filter((image): image is ProductImage => Boolean(image));
  const fileTypes = splitList(apiProduct.file_type);
  const tags = (detail.tags ?? []).map((tag) => tag.name);
  const createdAt = detail.date ?? new Date(0).toISOString();
  const updatedAt = detail.modified ?? createdAt;
  // Fixed-price detail responses also contain variable_prices: []. EDD's
  // price type takes precedence over stale option metadata and index labels.
  const variable = apiProduct.price.type === "variable" ||
    (apiProduct.price.type !== "single" && Boolean(detail.variable_prices?.length));
  const parseAmount = (value: unknown): number | null => {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (typeof value === "string" && !value.trim()) return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  };
  const rawOptions = variable ? detail.variable_prices ?? [] : [];
  const hasInvalidOption = rawOptions.some((option, index) => {
    const id = Number(option.id ?? index);
    return parseAmount(option.amount) === null || !Number.isSafeInteger(id) || id < 0;
  });
  const priceOptions = rawOptions.flatMap((option, index) => {
    const amount = parseAmount(option.amount);
    const id = Number(option.id ?? index);
    if (amount === null || !Number.isSafeInteger(id) || id < 0) return [];
    return [{
      id,
      name: decodeHtmlEntities(option.name ?? `Option ${index + 1}`),
      price: { amount: moneyAmount(amount), currency: option.currency ?? apiProduct.price.currency },
      isDefault: Boolean(option.default),
    }];
  });
  const fixedAmount = parseAmount(apiProduct.price.amount);
  const inferredClass = variable
    ? priceOptions.length === 0 || hasInvalidOption
      ? "invalid"
      : priceOptions.some((option) => option.price.amount < 0)
        ? "invalid"
        : priceOptions.every((option) => option.price.amount === 0)
          ? "free"
          : priceOptions.some((option) => option.price.amount === 0)
            ? "mixed"
            : "paid"
    : fixedAmount === null
      ? "invalid"
      : fixedAmount === 0
        ? "free"
        : "paid";
  // Variable option rows are the purchase choices and must not be contradicted
  // by a stale class field. Preserve an explicit backend invalid classification.
  const priceClass = apiProduct.price.class === "invalid"
    ? "invalid"
    : variable
      ? inferredClass
      : apiProduct.price.class ?? inferredClass;
  const validPrice = variable ? priceOptions.length > 0 && priceClass !== "invalid" : fixedAmount !== null && priceClass !== "invalid";
  const isFree = priceClass === "free" && validPrice;

  return {
    id: String(apiProduct.id),
    slug: apiProduct.slug,
    title: decodeHtmlEntities(apiProduct.title),
    shortDescription: stripHtml(detail.short_description),
    description: stripHtml(detail.description),
    seo: seoFromApi(apiProduct),
    price: {
      amount: variable && priceOptions.length
        ? Math.min(...priceOptions.map((option) => option.price.amount))
        : fixedAmount === null ? Number.NaN : moneyAmount(fixedAmount),
      currency: apiProduct.price.currency,
    },
    priceOptions: variable ? priceOptions : undefined,
    priceValid: validPrice,
    priceClass,
    status: detail.status === "publish" || !detail.status ? "active" : "draft",
    soldOut: apiProduct.availability?.sold_out === true,
    purchasable: validPrice ? apiProduct.availability?.available : false,
    productGroup: group,
    kind: productKind(apiProduct, group),
    categoryIds: (apiProduct.categories ?? []).map((category) => String(category.id)),
    categorySlugs: slugs,
    tags,
    keywords: tags.slice(0, 24),
    fileTypes,
    fileIncluded: fileTypes,
    fileSizeBytes: parseFileSize(apiProduct.file_size),
    compatibleWith: detail.compatible_with ? [detail.compatible_with] : [],
    documentationUrl: detail.documentation ? "/contact" : undefined,
    images,
    attributes: [],
    ratingAverage: 0,
    ratingCount: 0,
    salesCount: 0,
    featured,
    bestseller: false,
    isNew: Date.now() - Date.parse(createdAt) < 1000 * 60 * 60 * 24 * 90,
    isFree,
    isFeatured: featured,
    isSale: false,
    isCustomizable: false,
    licenses:
      detail.variable_prices && detail.variable_prices.length > 1
        ? ["personal", "commercial"]
        : ["personal"],
    createdAt,
    updatedAt,
  };
}

export function categoryFromApi(category: ChApiCategory): Category {
  return {
    id: String(category.id),
    slug: frontendCategorySlug(category.slug),
    name: decodeHtmlEntities(category.name),
    description: stripHtml(category.description),
    seo: seoFromApi(category),
    imageUrl:
      category.image_url || category.image?.url
        ? normalizeWordPressMediaUrl(category.image_url ?? category.image?.url ?? "")
        : undefined,
    parentId: category.parent ? String(category.parent) : null,
    productCount: category.count ?? 0,
    featured: category.parent === 0,
    sortOrder: category.parent === 0 ? 0 : 10,
  };
}

export function facetValuesFromCategories(categories: Category[]) {
  return categories
    .filter((category) => category.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount)
    .map((category) => ({
      value: category.slug,
      label: category.name,
      count: category.productCount,
    }));
}
