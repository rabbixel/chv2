import { cacheLife, cacheTag } from "next/cache";
import { getCollectionDirectoryService } from "@/lib/services";
import { cacheTags } from "@/lib/cache";

/**
 * Build the expensive WordPress-backed collection directory once per cache window.
 * This keeps the page usable as ISR while ensuring its upstream fan-out is not
 * repeated on every visit.
 */
export async function getCachedCollectionDirectoryEntries() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.categories);
  return getCollectionDirectoryService().listEntries();
}
