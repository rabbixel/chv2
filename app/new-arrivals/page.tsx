import type { Metadata } from "next";
import { CuratedProductListing } from "@/components/search/CuratedProductListing";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const revalidate = 1800;
export const metadata: Metadata = {
  title: "New arrivals",
  description: "Discover recently published Creative Hatti graphics, illustrations, fonts and templates.",
  alternates: { canonical: `${SITE.url}${routes.newArrivals()}` },
};

interface Props { searchParams?: Promise<Record<string, string | string[] | undefined>> }

export default async function NewArrivalsPage({ searchParams }: Props) {
  const query = (await searchParams) ?? {};
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = rawPage && /^[1-9]\d{0,4}$/.test(rawPage) ? Number(rawPage) : 1;
  return <CuratedProductListing title="New arrivals" description="Find the latest additions to the marketplace." pathname={routes.newArrivals()} sort="newest" page={page} />;
}
