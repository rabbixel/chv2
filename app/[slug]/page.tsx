import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Breadcrumbs, Container } from "@/components/layout";
import { JsonLd } from "@/components/seo";
import { SITE } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { getPostService } from "@/lib/services";
import styles from "./page.module.css";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

interface PostPageProps { params: Promise<{ slug: string }> }

function metaDescription(excerpt: string, description?: string): string {
  return description || excerpt.slice(0, 160);
}

function metaTitle(title: string, yoastTitle?: string): string {
  return (yoastTitle || title).replace(/\s*[-·]\s*Creative Hatti$/i, "");
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostService().getPostBySlug(slug);
  if (!post) return { title: "Article not found", robots: { index: false, follow: true } };
  const canonical = `${SITE.url}${routes.blogPost(post.slug)}`;
  const title = metaTitle(post.title, post.seoTitle);
  const description = metaDescription(post.excerpt, post.seoDescription);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE.name,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.modified,
      ...(post.image ? { images: [{ url: post.image.url, width: post.image.width, height: post.image.height, alt: post.image.alt || post.title }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? ""
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BlogPostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPostService().getPostBySlug(slug);
  if (!post) notFound();
  const canonical = `${SITE.url}${routes.blogPost(post.slug)}`;

  return (
    <Container size="narrow">
      <article className={styles.article}>
        <Breadcrumbs items={[{ label: "Home", href: routes.home() }, { label: "Blog", href: routes.blog() }, { label: post.title }]} />
        <header className={styles.header}>
          <time className={styles.date} dateTime={post.date}>{displayDate(post.date)}</time>
          <h1 className={styles.title}>{post.title}</h1>
          {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}
        </header>
        {post.image && (
          <Image
            src={post.image.url}
            alt={post.image.alt || post.title}
            width={post.image.width}
            height={post.image.height}
            priority
            unoptimized
            className={styles.featuredImage}
          />
        )}
        <div className={styles.content} dangerouslySetInnerHTML={{ __html: post.content }} />
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: metaDescription(post.excerpt, post.seoDescription),
          mainEntityOfPage: canonical,
          datePublished: post.date,
          dateModified: post.modified,
          author: { "@type": "Organization", name: SITE.name },
          publisher: { "@type": "Organization", name: SITE.name },
          ...(post.image ? { image: [post.image.url] } : {}),
        }} />
      </article>
    </Container>
  );
}
