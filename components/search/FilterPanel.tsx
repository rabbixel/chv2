"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  buildListingHref,
  withListingPatch,
  type ListingParams,
} from "@/lib/search-params";
import { getGroup, productGroups } from "@/lib/taxonomy";
import type { Collection, SearchFacetValue } from "@/lib/types";
import styles from "./FilterPanel.module.css";

export interface FilterPanelProps {
  params: ListingParams;
  categoryFacet: SearchFacetValue[];
  fileTypeFacet: SearchFacetValue[];
  collections: Collection[];
  /** Base path for filter URLs ("/search", later category pages). */
  basePath?: string;
  idPrefix?: string;
  /** Hide the group section (category pages already constrain by group). */
  hideGroups?: boolean;
  /** Hide the collection select (collection pages already constrain). */
  hideCollection?: boolean;
}

const FILE_TYPES = ["AI", "EPS", "PNG", "JPG", "SVG", "PSD", "PDF"];

const COMPAT_APPS = [
  { value: "illustrator", label: "Illustrator" },
  { value: "photoshop", label: "Photoshop" },
  { value: "figma", label: "Figma & Sketch" },
  { value: "canva", label: "Canva" },
];

const PRICE_PRESETS: Array<{
  label: string;
  min?: number;
  max?: number;
}> = [
  { label: "Any price" },
  { label: "Under ₹500", max: 500 },
  { label: "₹500 – ₹1,000", min: 500, max: 1000 },
  { label: "Over ₹1,000", min: 1000 },
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((entry) => entry !== value)
    : [...list, value];
}

export function FilterPanel({
  params,
  categoryFacet,
  fileTypeFacet,
  collections,
  basePath = "/search",
  idPrefix = "filter",
  hideGroups = false,
  hideCollection = false,
}: FilterPanelProps) {
  const router = useRouter();
  const push = (patch: Partial<ListingParams>) => {
    router.push(buildListingHref(basePath, withListingPatch(params, patch)));
  };

  const catCount = (slug: string) =>
    categoryFacet.find((entry) => entry.value === slug)?.count ?? 0;
  const fileCount = (type: string) =>
    fileTypeFacet.find((entry) => entry.value === type)?.count ?? 0;

  const priceSelected = (preset: { min?: number; max?: number }) =>
    params.min === preset.min && params.max === preset.max;

  const clearHref = buildListingHref(
    basePath,
    withListingPatch(params, {
      groups: [],
      cats: [],
      min: undefined,
      max: undefined,
      avail: undefined,
      files: [],
      apps: [],
      collection: undefined,
    }),
  );

  const vectorGroup = getGroup("vector-creatives");
  const characterGroup = getGroup("character-bundle");

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <p className={styles.title}>Filters</p>
        <Link href={clearHref} className={styles.clear}>
          Clear all
        </Link>
      </div>

      {!hideGroups && (
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Product Group</legend>
        {productGroups.map((group) => (
          <label key={group.slug} className={styles.check}>
            <input
              type="checkbox"
              checked={params.groups.includes(group.slug as (typeof params.groups)[number])}
              onChange={() =>
                push({
                  groups: toggle(params.groups, group.slug) as typeof params.groups,
                })
              }
            />
            <span>{group.name}</span>
          </label>
        ))}
      </fieldset>
      )}

      {vectorGroup && (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Vector Creative Categories</legend>
          {vectorGroup.subcategories.map((sub) => (
            <label key={sub.slug} className={styles.check}>
              <input
                type="checkbox"
                checked={params.cats.includes(sub.slug)}
                onChange={() => push({ cats: toggle(params.cats, sub.slug) })}
              />
              <span>{sub.name}</span>
              <span className={styles.count}>{catCount(sub.slug)}</span>
            </label>
          ))}
        </fieldset>
      )}

      {characterGroup && (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Character Categories</legend>
          {characterGroup.subcategories.map((sub) => (
            <label key={sub.slug} className={styles.check}>
              <input
                type="checkbox"
                checked={params.cats.includes(sub.slug)}
                onChange={() => push({ cats: toggle(params.cats, sub.slug) })}
              />
              <span>{sub.name}</span>
              <span className={styles.count}>{catCount(sub.slug)}</span>
            </label>
          ))}
        </fieldset>
      )}

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Availability</legend>
        {[
          { label: "All assets", value: undefined },
          { label: "Free", value: "free" },
          { label: "Paid", value: "paid" },
        ].map((option) => (
          <label key={option.label} className={styles.check}>
            <input
              type="radio"
              name={`${idPrefix}-avail`}
              checked={params.avail === option.value}
              onChange={() =>
                push({
                  avail: option.value as ListingParams["avail"],
                })
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Price</legend>
        {PRICE_PRESETS.map((preset) => (
          <label key={preset.label} className={styles.check}>
            <input
              type="radio"
              name={`${idPrefix}-price`}
              checked={priceSelected(preset)}
              onChange={() => push({ min: preset.min, max: preset.max })}
            />
            <span>{preset.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>File Type</legend>
        {FILE_TYPES.map((type) => {
          const count = fileCount(type);
          return (
            <label
              key={type}
              className={styles.check}
              data-disabled={count === 0 && !params.files.includes(type)}
            >
              <input
                type="checkbox"
                checked={params.files.includes(type)}
                disabled={count === 0 && !params.files.includes(type)}
                onChange={() => push({ files: toggle(params.files, type) })}
              />
              <span>{type}</span>
              <span className={styles.count}>{count}</span>
            </label>
          );
        })}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Compatible Software</legend>
        {COMPAT_APPS.map((app) => (
          <label key={app.value} className={styles.check}>
            <input
              type="checkbox"
              checked={params.apps.includes(app.value)}
              onChange={() => push({ apps: toggle(params.apps, app.value) })}
            />
            <span>{app.label}</span>
          </label>
        ))}
      </fieldset>

      {!hideCollection && (
      <div className={styles.group}>
        <label htmlFor={`${idPrefix}-collection`} className={styles.legend}>
          Collection
        </label>
        <select
          id={`${idPrefix}-collection`}
          className={styles.select}
          value={params.collection ?? ""}
          onChange={(event) =>
            push({ collection: event.target.value || undefined })
          }
        >
          <option value="">All collections</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.slug}>
              {collection.title}
            </option>
          ))}
        </select>
      </div>
      )}
    </div>
  );
}
