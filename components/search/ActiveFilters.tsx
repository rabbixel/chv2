import Link from "next/link";
import { Icon } from "@/components/ui";
import {
  buildListingHref,
  withListingPatch,
  type ListingParams,
} from "@/lib/search-params";
import { categoryDisplayName } from "@/lib/taxonomy";
import type { Collection } from "@/lib/types";
import styles from "./ActiveFilters.module.css";

export interface ActiveFiltersProps {
  params: ListingParams;
  collections: Collection[];
  basePath?: string;
}

interface Chip {
  key: string;
  label: string;
  href: string;
}

function priceLabel(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `₹${min} – ₹${max}`;
  if (min !== undefined) return `Over ₹${min}`;
  if (max !== undefined) return `Under ₹${max}`;
  return "Price";
}

export function ActiveFilters({
  params,
  collections,
  basePath = "/search",
}: ActiveFiltersProps) {
  const chips: Chip[] = [];

  for (const group of params.groups) {
    chips.push({
      key: `group-${group}`,
      label: categoryDisplayName(group),
      href: buildListingHref(
        basePath,
        withListingPatch(params, {
          groups: params.groups.filter((entry) => entry !== group),
        }),
      ),
    });
  }
  for (const cat of params.cats) {
    chips.push({
      key: `cat-${cat}`,
      label: categoryDisplayName(cat),
      href: buildListingHref(
        basePath,
        withListingPatch(params, {
          cats: params.cats.filter((entry) => entry !== cat),
        }),
      ),
    });
  }
  if (params.min !== undefined || params.max !== undefined) {
    chips.push({
      key: "price",
      label: priceLabel(params.min, params.max),
      href: buildListingHref(
        basePath,
        withListingPatch(params, { min: undefined, max: undefined }),
      ),
    });
  }
  if (params.avail) {
    chips.push({
      key: "avail",
      label: params.avail === "free" ? "Free" : "Paid",
      href: buildListingHref(
        basePath,
        withListingPatch(params, { avail: undefined }),
      ),
    });
  }
  for (const file of params.files) {
    chips.push({
      key: `file-${file}`,
      label: file,
      href: buildListingHref(
        basePath,
        withListingPatch(params, {
          files: params.files.filter((entry) => entry !== file),
        }),
      ),
    });
  }
  for (const app of params.apps) {
    chips.push({
      key: `app-${app}`,
      label: app.charAt(0).toUpperCase() + app.slice(1),
      href: buildListingHref(
        basePath,
        withListingPatch(params, {
          apps: params.apps.filter((entry) => entry !== app),
        }),
      ),
    });
  }
  if (params.collection) {
    const collection = collections.find(
      (entry) => entry.slug === params.collection,
    );
    chips.push({
      key: "collection",
      label: collection ? collection.title : params.collection,
      href: buildListingHref(
        basePath,
        withListingPatch(params, { collection: undefined }),
      ),
    });
  }

  if (chips.length === 0) return null;

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

  return (
    <div className={styles.active}>
      <ul className={styles.chips} aria-label="Active filters">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              className={styles.chip}
              aria-label={`Remove filter ${chip.label}`}
            >
              {chip.label}
              <Icon name="close" size={14} />
            </Link>
          </li>
        ))}
      </ul>
      <Link href={clearHref} className={styles.clear}>
        Clear all
      </Link>
    </div>
  );
}
