import type { Metadata } from "next";
import { CuratedProductListing } from "@/components/search/CuratedProductListing";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";

export const revalidate = 1800;
export const metadata: Metadata = {
  title: "Popular designs",
  description: "Explore Creative Hatti products ordered by recorded EDD sales.",
  alternates: { canonical: `${SITE.url}${routes.popular()}` },
};

interface Props { searchParams?: Promise<Record<string, string | string[] | undefined>> }

export default async function PopularPage({ searchParams }: Props) {
  const query = (await searchParams) ?? {};
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = rawPage && /^[1-9]\d{0,4}$/.test(rawPage) ? Number(rawPage) : 1;
  return <CuratedProductListing title="Popular designs" description="Browse assets ranked by the site's recorded product sales." pathname={routes.popular()} sort="best-selling" page={page} />;
}
