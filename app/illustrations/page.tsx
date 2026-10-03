import CategoryPage, { generateMetadata as categoryMetadata } from "@/app/category/[slug]/page";
import { routes } from "@/lib/routes";
import { SITE } from "@/lib/constants";

interface Props { searchParams?: Promise<Record<string, string | string[] | undefined>> }
export const revalidate = 3600;
export async function generateMetadata() {
  const metadata = await categoryMetadata({ params: Promise.resolve({ slug: "illustrations" }) });
  return { ...metadata, alternates: { canonical: `${SITE.url}${routes.illustrations()}` } };
}
export default function IllustrationsPage({ searchParams }: Props) {
  return CategoryPage({ params: Promise.resolve({ slug: "illustrations" }), searchParams });
}
