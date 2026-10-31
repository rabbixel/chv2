"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { ImageOrientation, SearchSortKey } from "@/lib/types";
import { productGroups } from "@/lib/taxonomy";
import styles from "./GalleryFilters.module.css";

export interface GalleryCategoryOption {
  value: string;
  label: string;
  group: string;
  count?: number;
}

const orientationOptions: Array<{ value: ImageOrientation; label: string }> = [
  { value: "all", label: "All orientations" },
  { value: "landscape", label: "Landscape" },
  { value: "portrait", label: "Portrait" },
  { value: "square", label: "Square" },
];

const sortOptions: Array<{ value: SearchSortKey; label: string }> = [
  { value: "relevance", label: "Most relevant" },
  { value: "newest", label: "Newest" },
  { value: "best-selling", label: "Best selling" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

const listingSortOptions: Array<{ value: SearchSortKey; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Recent" },
  { value: "best-selling", label: "Best selling" },
  { value: "oldest", label: "Older" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
  { value: "rating", label: "Rating" },
];

const fileTypeOptions = ["AI", "EPS", "PNG", "JPG", "SVG", "PSD", "PDF"];
const appOptions = [
  { value: "illustrator", label: "Illustrator" },
  { value: "photoshop", label: "Photoshop" },
  { value: "figma", label: "Figma & Sketch" },
  { value: "canva", label: "Canva" },
];

export function GalleryFilters({
  action,
  mode = "preview",
  query,
  category,
  selectedCategories,
  categories,
  price,
  orientation,
  sort,
  density,
  overlay,
  clearHref,
  groups = [],
  minPrice,
  maxPrice,
  files = [],
  apps = [],
  collection,
  collections = [],
}: {
  action: string;
  mode?: "preview" | "search";
  query: string;
  category: string;
  selectedCategories: string[];
  categories: GalleryCategoryOption[];
  price: "all" | "free" | "paid";
  orientation: ImageOrientation;
  sort: SearchSortKey;
  density: "compact" | "comfortable";
  overlay: "hover" | "always";
  clearHref: string;
  groups?: string[];
  minPrice?: number;
  maxPrice?: number;
  files?: string[];
  apps?: string[];
  collection?: string;
  collections?: Array<{ slug: string; title: string }>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchValue, setSearchValue] = useState(query);
  const [categorySearch, setCategorySearch] = useState("");
  const filteredCategories = useMemo(() => {
    const term = categorySearch.trim().toLocaleLowerCase();
    return term ? categories.filter((option) => option.label.toLocaleLowerCase().includes(term)) : categories;
  }, [categories, categorySearch]);
  const selectedCategoriesOutsideSearch = selectedCategories.filter(
    (slug) => !filteredCategories.some((option) => option.value === slug),
  );
  const clearBrowseScopeForPrice = (event: ChangeEvent<HTMLInputElement>) => {
    const scope = event.currentTarget.form?.elements.namedItem("category") as RadioNodeList | null;
    if (scope) scope.value = "all";
  };
  const activeFilterCount = selectedCategories.length
    + (orientation !== "all" ? 1 : 0)
    + (mode === "preview" && category !== "all" ? 1 : groups.length)
    + (price !== "all" && !(mode === "preview" && category === "freebies" && price === "free") ? 1 : 0)
    + (minPrice !== undefined || maxPrice !== undefined ? 1 : 0)
    + files.length + apps.length + (collection ? 1 : 0);
  const formKey = [mode, query, category, selectedCategories.join(","), groups.join(","), price, orientation, sort, minPrice, maxPrice, files.join(","), apps.join(","), collection, density, overlay].join("|");
  useEffect(() => {
    const closeRestoredDialog = () => {
      if (dialogRef.current?.open) dialogRef.current.close();
    };
    window.addEventListener("pageshow", closeRestoredDialog);
    window.addEventListener("popstate", closeRestoredDialog);
    return () => {
      window.removeEventListener("pageshow", closeRestoredDialog);
      window.removeEventListener("popstate", closeRestoredDialog);
    };
  }, []);

  return (
    <form key={formKey} className={styles.toolbar} method="get" action={action}>
      <div className={styles.search}>
        <label className="ch-visually-hidden" htmlFor={`gallery-search-${mode}`}>Search artwork</label>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6" /><path d="m16 16 4.2 4.2" /></svg>
        <input ref={searchRef} className={styles.searchInput} type="search" id={`gallery-search-${mode}`} name="q" value={searchValue} onChange={(event) => setSearchValue(event.currentTarget.value)} placeholder="Search illustrations..." maxLength={160} />
        {searchValue && <button className={styles.clearSearch} type="button" aria-label="Clear search" onClick={() => { setSearchValue(""); searchRef.current?.focus(); }}>×</button>}
      </div>
      <input type="hidden" name="page" value="1" />
      {selectedCategoriesOutsideSearch.map((slug) => <input key={slug} type="hidden" name="cat" value={slug} />)}
      <button className={styles.filterButton} type="button" onClick={() => dialogRef.current?.showModal()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10m-7 6h4" /><circle cx="8" cy="6" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="12" cy="18" r="1.5" /></svg>
        Filters{activeFilterCount > 0 && <span className={styles.filterCount}>{activeFilterCount}</span>}
      </button>
      <label className={styles.sort}>
        <span>Sort by</span>
        <select name="sort" defaultValue={sort} aria-label="Sort products">
          {(mode === "search" ? listingSortOptions : sortOptions).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <button className={styles.submit} type="submit">Show results</button>

      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="gallery-filter-title">
        <div className={styles.dialogHeader}>
          <div><p className={styles.eyebrow}>Refine your results</p><h2 id="gallery-filter-title">Filters</h2></div>
          <button className={styles.close} type="button" aria-label="Close filters" onClick={() => dialogRef.current?.close()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className={styles.dialogBody}>
          {mode === "preview" ? <fieldset className={styles.filterSection}>
            <legend>Browse</legend>
            <div className={styles.scopeOptions}>
              {[{ value: "all", label: "All products" }, { value: "freebies", label: "Freebies" }, { value: "festival", label: "Festival graphics" }, { value: "characters", label: "Characters" }].map((option) => (
                <label key={option.value} className={styles.radioOption}><input type="radio" name="category" value={option.value} defaultChecked={category === option.value} />{option.label}</label>
              ))}
            </div>
          </fieldset> : <fieldset className={styles.filterSection}>
            <legend>Product groups</legend>
            <div className={styles.scopeOptions}>
              {productGroups.map((group) => <label key={group.slug} className={styles.radioOption}><input type="checkbox" name="group" value={group.slug} defaultChecked={groups.includes(group.slug)} />{group.name}</label>)}
            </div>
          </fieldset>}

          <fieldset className={styles.filterSection}>
            <legend>Categories</legend>
            <label className={styles.categorySearch}><span className="ch-visually-hidden">Search categories</span><input type="search" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Search categories" /></label>
            <p className={styles.helpText}>{mode === "preview" ? "Choose up to 8 categories." : "Categories available in these search results."}</p>
            <div className={styles.categoryList}>
              {filteredCategories.length ? filteredCategories.map((option) => (
                <label key={option.value} className={styles.categoryOption}>
                  <input type="checkbox" name="cat" value={option.value} defaultChecked={selectedCategories.includes(option.value)} disabled={mode === "preview" && selectedCategories.length >= 8 && !selectedCategories.includes(option.value)} />
                  <span>{option.label}<small>{option.group}</small></span>
                  {option.count !== undefined && <span className={styles.categoryCount}>{option.count}</span>}
                </label>
              )) : <p className={styles.noCategories}>No matching categories in these results.</p>}
            </div>
          </fieldset>

          <fieldset className={styles.filterSection}>
            <legend>Price</legend>
            <div className={styles.inlineOptions}>
              {[{ value: "all", label: "All" }, { value: "free", label: "Free" }, { value: "paid", label: "Paid" }].map((option) => (
                <label key={option.value} className={styles.radioOption}><input type="radio" name="avail" value={option.value} defaultChecked={price === option.value} onChange={clearBrowseScopeForPrice} />{option.label}</label>
              ))}
            </div>
          </fieldset>

          {mode === "search" && <fieldset className={styles.filterSection}>
            <legend>Price range (₹)</legend>
            <div className={styles.priceRange}>
              <label>Minimum<input type="number" name="min" min="0" step="1" defaultValue={minPrice} /></label>
              <label>Maximum<input type="number" name="max" min="0" step="1" defaultValue={maxPrice} /></label>
            </div>
          </fieldset>}

          {mode === "search" && <fieldset className={styles.filterSection}>
            <legend>File type</legend>
            <div className={styles.inlineOptions}>{[...new Set([...fileTypeOptions, ...files])].map((file) => <label key={file} className={styles.radioOption}><input type="checkbox" name="file" value={file} defaultChecked={files.includes(file)} />{file}</label>)}</div>
          </fieldset>}

          {mode === "search" && <fieldset className={styles.filterSection}>
            <legend>Compatible software</legend>
            <div className={styles.inlineOptions}>{[...appOptions, ...apps.filter((app) => !appOptions.some((option) => option.value === app)).map((app) => ({ value: app, label: app }))].map((option) => <label key={option.value} className={styles.radioOption}><input type="checkbox" name="app" value={option.value} defaultChecked={apps.includes(option.value)} />{option.label}</label>)}</div>
          </fieldset>}

          {mode === "search" && <fieldset className={styles.filterSection}>
            <legend>Collection</legend>
            <label className={styles.selectOption}><span className="ch-visually-hidden">Choose collection</span><select name="collection" defaultValue={collection ?? ""}><option value="">All collections</option>{collection && !collections.some((entry) => entry.slug === collection) && <option value={collection}>{collection}</option>}{collections.map((entry) => <option key={entry.slug} value={entry.slug}>{entry.title}</option>)}</select></label>
          </fieldset>}

          <fieldset className={styles.filterSection}>
            <legend>Orientation</legend>
            <div className={styles.inlineOptions}>
              {orientationOptions.map((option) => (
                <label key={option.value} className={styles.radioOption}><input type="radio" name="orientation" value={option.value} defaultChecked={orientation === option.value} />{option.label}</label>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.filterSection}>
            <legend>Gallery display</legend>
            <label className={styles.selectOption}>Density
              <select name="density" defaultValue={density}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select>
            </label>
            <label className={styles.selectOption}>Overlay
              <select name="overlay" defaultValue={overlay}><option value="hover">Hover only</option><option value="always">Always show</option></select>
            </label>
          </fieldset>
        </div>
        <div className={styles.dialogFooter}>
          <a href={clearHref}>Clear filters</a>
          <button type="submit" className={styles.submit}>Show results</button>
        </div>
      </dialog>
    </form>
  );
}

export const gallerySortValues = sortOptions.map(({ value }) => value);
