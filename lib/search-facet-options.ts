export interface FacetOptionCount {
  value: string;
  count: number;
}

/** Keep only options present in the collection-wide facets or already selected. */
export function filterOptionsByFacet<T>(
  options: readonly T[],
  getValue: (option: T) => string,
  facets: readonly FacetOptionCount[],
  selected: readonly string[] = [],
): T[] {
  const available = new Set(
    facets.filter((facet) => facet.count > 0).map((facet) => facet.value),
  );
  const active = new Set(selected);
  return options.filter((option) => {
    const value = getValue(option);
    return available.has(value) || active.has(value);
  });
}
