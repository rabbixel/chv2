import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, Container } from "@/components/layout";
import { ProductGrid } from "@/components/product";
import { ApiError, apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { REVALIDATE_SECONDS, cacheTags } from "@/lib/cache";
import { productFromApi } from "@/lib/creative-hatti/adapters";
import type { ChApiEnvelope, ChApiPagination, ChApiProductCard, ChApiSeo } from "@/lib/creative-hatti/types";
import { SITE } from "@/lib/constants";
import { decodeHtmlEntities } from "@/lib/creative-hatti/html";

export const revalidate = 3600;
const PAGE_SIZE = 24;

interface TagArchive {
  tag: { id: number; name: string; slug: string; description?: string; count: number; seo?: ChApiSeo };
  products: ChApiProductCard[];
  pagination: ChApiPagination;
}

interface Props {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ page?: string | string[] }>;
}

function archivePath(slug: string, page: number) {
  const base = `/tag/${encodeURIComponent(slug)}`;
  return page > 1 ? `${base}?page=${page}` : base;
}

function parsePage(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d{0,5}$/.test(raw)) return 1;
  return Math.min(100000, Number(raw));
}

async function getArchive(slug: string, page: number): Promise<TagArchive | null> {
  if (!/^[a-z0-9_-]+$/i.test(slug)) return null;
  try {
    const response = await apiFetch<ChApiEnvelope<TagArchive>>(
      apiEndpoints.tags.detail(slug),
      {
        searchParams: { page, per_page: PAGE_SIZE },
        revalidate: REVALIDATE_SECONDS.catalog,
        tags: [cacheTags.products],
      },
    );
    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = parsePage((await searchParams)?.page);
  const archive = await getArchive(slug, page);
  if (!archive || (page > 1 && page > archive.pagination.total_pages)) {
    return { title: "Tag not found", robots: { index: false, follow: true } };
  }

  const name = decodeHtmlEntities(archive.tag.name);
  const title = archive.tag.seo?.title ? decodeHtmlEntities(archive.tag.seo.title) : `${name} Vectors & Illustrations`;
  const description = archive.tag.seo?.description
    ? decodeHtmlEntities(archive.tag.seo.description)
    : `Explore ${name} vector illustrations and downloadable creative assets at Creative Hatti.`;
  // Historical Yoast canonical URLs point to the retired WordPress /downloads/tag/ route.
  // The Next.js route is authoritative; page 2+ must not canonicalize to page 1.
  const canonical = `${SITE.url}${archivePath(archive.tag.slug, page)}`;
  return {
    title: page > 1 ? `${title} — Page ${page}` : title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: SITE.name, type: "website" },
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = parsePage((await searchParams)?.page);
  const archive = await getArchive(slug, page);
  if (!archive || (page > 1 && page > archive.pagination.total_pages)) notFound();

  const name = decodeHtmlEntities(archive.tag.name);
  const products = archive.products.map(productFromApi);
  return (
    <Container size="wide">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: name }]} />
      <header style={{ marginBlock: "2rem" }}>
        <h1>{name} Vectors &amp; Illustrations</h1>
        {archive.tag.description && <p>{decodeHtmlEntities(archive.tag.description.replace(/<[^>]*>/g, " "))}</p>}
      </header>
      <ProductGrid
        products={products}
        totalItems={archive.pagination.total}
        pagination={{
          page,
          totalPages: archive.pagination.total_pages,
          buildHref: (nextPage) => archivePath(archive.tag.slug, nextPage),
        }}
        empty={{ title: "No artwork found", description: "This tag does not have any published downloads yet." }}
      />
    </Container>
  );
}
