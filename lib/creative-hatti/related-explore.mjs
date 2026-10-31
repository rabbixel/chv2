function tokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

/** Keep the existing all-query-tokens relationship rule, with safe exclusions. */
export function selectRelatedCollections(product, collections, limit = 4, excludedSlugs = []) {
  const excluded = new Set(excludedSlugs);
  const productTokens = new Set([
    product.title,
    product.productGroup,
    ...(product.categorySlugs ?? []),
    ...(product.tags ?? []),
    ...(product.keywords ?? []),
  ].flatMap(tokens));
  const seen = new Set();
  const maximum = Math.max(0, Math.min(4, Math.floor(limit)));

  return collections.filter((collection) => {
    const slug = String(collection.slug ?? "");
    if (!slug || excluded.has(slug) || seen.has(slug)) return false;
    const queryTokens = tokens(collection.query);
    if (queryTokens.length === 0 || !queryTokens.every((token) => productTokens.has(token))) return false;
    seen.add(slug);
    return true;
  }).slice(0, maximum);
}

/** Keep product taxonomy order, but link only categories exposed by the API. */
export function selectRelatedCategories(productCategorySlugs, categories, limit = 6, excludedSlugs = []) {
  const excluded = new Set(excludedSlugs);
  const accessible = new Map(categories.map((category) => [category.slug, category]));
  const seen = new Set();
  const maximum = Math.max(0, Math.min(6, Math.floor(limit)));

  return productCategorySlugs.flatMap((slug) => {
    if (!slug || excluded.has(slug) || seen.has(slug) || !accessible.has(slug)) return [];
    seen.add(slug);
    return [accessible.get(slug)];
  }).slice(0, maximum);
}
