import type { Metadata } from "next";
import { CuratedProductListing } from "@/components/search/CuratedProductListing";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const revalidate = 1800;
export const metadata: Metadata = {
  title: "Free downloads",
  description: "Browse Creative Hatti digital products listed at no charge.",
  alternates: { canonical: `${SITE.url}${routes.freeDownloads()}` },
};

interface Props { searchParams?: Promise<Record<string, string | string[] | undefined>> }

export default async function FreeDownloadsPage({ searchParams }: Props) {
  const query = (await searchParams) ?? {};
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = rawPage && /^[1-9]\d{0,4}$/.test(rawPage) ? Number(rawPage) : 1;
  return <CuratedProductListing title="Free downloads" description="Explore creative designs you can download for free." pathname={routes.freeDownloads()} sort="newest" freeOnly page={page} />;
}
