import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs, Container } from "@/components/layout";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getPostService } from "@/lib/services";
import styles from "./page.module.css";

export const revalidate = 3600;
export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

interface BlogIndexProps {
  searchParams?: Promise<{ page?: string | string[] }>;
}

export async function generateMetadata({ searchParams }: BlogIndexProps): Promise<Metadata> {
  const query = (await searchParams) ?? {};
  const requested = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = Number(requested) || 1;
  return {
    title: "Creative Hatti Blog",
    description: "Design insights, Indian vector art, creative tools and ideas from Creative Hatti.",
    alternates: { canonical: `${SITE.url}${routes.blog()}` },
    ...(page > 1 ? { robots: { index: false, follow: true } } : {}),
  };
}

function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? ""
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BlogIndexPage({ searchParams }: BlogIndexProps) {
  const query = (await searchParams) ?? {};
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = Math.max(1, Math.floor(Number(rawPage) || 1));
  const result = await getPostService().listPosts(page, PAGE_SIZE);

  return (
    <Container size="wide">
      <div className={styles.page}>
        <Breadcrumbs items={[{ label: "Home", href: routes.home() }, { label: "Blog" }]} />
        <header className={styles.header}>
          <p className={styles.kicker}>Ideas &amp; inspiration</p>
          <h1 className={styles.title}>Creative Hatti Blog</h1>
          <p className={styles.description}>Design insights, Indian vector art, creative tools and ideas from our team.</p>
          <p className={styles.count}>{result.total.toLocaleString("en-IN")} articles</p>
        </header>

        {result.items.length > 0 ? (
          <>
            <ol className={styles.grid}>
              {result.items.map((post) => (
                <li className={styles.card} key={post.id}>
                  <Link className={styles.cardLink} href={routes.blogPost(post.slug)}>
                    {post.image && (
                      <span className={styles.imageFrame}>
                        <Image
                          src={post.image.url}
                          alt={post.image.alt || post.title}
                          width={post.image.width}
                          height={post.image.height}
                          unoptimized
                          className={styles.image}
                        />
                      </span>
                    )}
                    <span className={styles.cardBody}>
                      <time className={styles.date} dateTime={post.date}>{displayDate(post.date)}</time>
                      <span className={styles.cardTitle}>{post.title}</span>
                      {post.excerpt && <span className={styles.excerpt}>{post.excerpt}</span>}
                      <span className={styles.readMore}>Read article <span aria-hidden="true">→</span></span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            {result.totalPages > 1 && (
              <nav className={styles.pagination} aria-label="Blog pages">
                {page > 1 ? <Link href={`${routes.blog()}?page=${page - 1}`} rel="prev">← Newer articles</Link> : <span />}
                <span>Page {page} of {result.totalPages}</span>
                {page < result.totalPages ? <Link href={`${routes.blog()}?page=${page + 1}`} rel="next">Older articles →</Link> : <span />}
              </nav>
            )}
          </>
        ) : (
          <p className={styles.empty}>No articles are available right now.</p>
        )}
      </div>
    </Container>
  );
}
