const CHARACTER_FREEBIE_CATEGORIES = new Set([
  "actors",
  "actress",
  "business-person",
  "politician",
  "singers",
  "spiritual-mentor",
  "sports",
  "youtuber",
]);
const CHARACTER_TITLE_TERMS = /\b(?:actor|actress|character|celebrity|cricketer|god|goddess|people|person|politician|portrait|singer|youtuber)\b/i;

/**
 * Keep only active freebie character artwork, preserving indexed-search order.
 * Free-only availability is enforced by the search service before this helper.
 *
 * @param {import("../types/product").Product[]} products
 * @param {number} limit
 * @returns {import("../types/product").Product[]}
 */
export function selectPopularFreeCharacters(products, limit = 8) {
  const safeLimit = Math.max(0, Math.min(8, Math.floor(limit)));
  if (safeLimit === 0) return [];

  const seen = new Set();
  return products.filter((product) => {
    if (
      product.status !== "active" ||
      product.productGroup !== "freebies" ||
      product.kind !== "freebie" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug) ||
      !product.images.some((image) => image.url.trim().length > 0) ||
      (!product.categorySlugs.some((category) => CHARACTER_FREEBIE_CATEGORIES.has(category)) &&
        !CHARACTER_TITLE_TERMS.test(`${product.title} ${product.keywords.join(" ")}`))
    ) return false;

    const key = String(product.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, safeLimit);
}
