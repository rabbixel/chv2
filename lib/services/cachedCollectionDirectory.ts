import { unstable_cache } from "next/cache";
import { getCollectionDirectoryService } from "@/lib/services";
import { cacheTags, REVALIDATE_SECONDS } from "@/lib/cache";

/**
 * Cache the WordPress-backed directory separately from the page response.
 * This lets the route avoid repeating its upstream fan-out on every visit.
 */
export const getCachedCollectionDirectoryEntries = unstable_cache(
  async () => getCollectionDirectoryService().listEntries(),
  ["collections-directory"],
  { revalidate: REVALIDATE_SECONDS.catalog, tags: [cacheTags.categories] },
);
