import { apiFetch } from "@/lib/api/client";
import { apiEndpoints } from "@/lib/api/endpoints";
import { cacheTags, REVALIDATE_SECONDS } from "@/lib/cache";
import type { BlogPost, BlogPostImage, BlogPostSitemapEntry } from "@/lib/types";
import { isLiveApiEnabled } from "./apiMode";

interface WordPressRendered { rendered: string }
interface WordPressPost {
  id: number;
  slug: string;
  date: string;
  modified: string;
  title: WordPressRendered;
  excerpt: WordPressRendered;
  content?: WordPressRendered;
  featured_media: number;
  yoast_head_json?: {
    title?: string;
    description?: string;
    og_image?: Array<{ url?: string; width?: number; height?: number }>;
  };
}

const postSummaryFields = "id,slug,date,modified,title,excerpt,featured_media,yoast_head_json";
const postDetailFields = `${postSummaryFields},content`;
const postCache = (slug?: string) => ({
  revalidate: REVALIDATE_SECONDS.catalog,
  tags: slug ? [cacheTags.blogPosts, cacheTags.blogPost(slug)] : [cacheTags.blogPosts],
  wordpress: true as const,
});

/**
 * Migrated post HTML can reference WordPress-generated size variants that were
 * intentionally not copied to the API host. Rewrite upload URLs in both src
 * and srcset to the retained original file so responsive selection cannot
 * request a missing variant.
 */
function restoreOriginalWordPressImageUrls(content: string): string {
  return content.replace(/https?:[^\s"'<>]+/gi, (url) => {
    if (!url.includes("/wp-content/uploads/")) return url;
    return url.replace(/-\d+x\d+(?=\.(?:avif|bmp|gif|jpe?g|png|tiff?|webp)(?:[?#]|$))/gi, "");
  });
}

function normalizedWordPressImageUrl(url: string): string {
  return url
    .split(/[?#]/, 1)[0]
    .replace(/-\d+x\d+(?=\.(?:avif|bmp|gif|jpe?g|png|tiff?|webp)$)/i, "");
}

/** Remove only the first body image when it is the same file as the hero image. */
function removeDuplicateFeaturedImage(content: string, featuredUrl?: string): string {
  if (!featuredUrl) return content;
  const firstImage = /<img\b[^>]*>/i.exec(content);
  if (!firstImage || firstImage.index === undefined) return content;
  const source = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(firstImage[0])?.[2];
  if (!source || normalizedWordPressImageUrl(source) !== normalizedWordPressImageUrl(featuredUrl)) {
    return content;
  }

  // If WordPress placed the image alone in a paragraph, remove that empty wrapper too.
  const paragraph = /<p\b[^>]*>\s*(?:<a\b[^>]*>\s*)?<img\b[^>]*>\s*(?:<\/a>\s*)?<\/p>/i.exec(content);
  const imageEnd = firstImage.index + firstImage[0].length;
  if (
    paragraph &&
    paragraph.index !== undefined &&
    paragraph.index <= firstImage.index &&
    paragraph.index + paragraph[0].length >= imageEnd
  ) {
    return content.slice(0, paragraph.index) + content.slice(paragraph.index + paragraph[0].length);
  }
  return content.slice(0, firstImage.index) + content.slice(imageEnd);
}

/** Decode double-escaped or semicolon-less curly-quote entities from migrated HTML. */
function normalizeCurlyQuoteEntities(content: string): string {
  return content
    .replace(/&amp;#(8216|8217|8220|8221);?/gi, "&#$1;")
    .replace(/&#(8216|8217|8220|8221)(?!;)/gi, "&#$1;");
}

function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&hellip;/g, "…")
    .replace(/\s+/g, " ")
    .trim();
}

function mapPost(post: WordPressPost): BlogPost {
  const featured = post.yoast_head_json?.og_image?.find((image) => image.url);
  const image: BlogPostImage | undefined = featured?.url ? {
    url: featured.url,
    alt: plainText(post.title.rendered),
    width: featured.width || 1200,
    height: featured.height || 800,
  } : undefined;
  const content = post.content?.rendered ?? "";
  const normalizedContent = normalizeCurlyQuoteEntities(
    removeDuplicateFeaturedImage(restoreOriginalWordPressImageUrls(content), featured?.url),
  );
  return {
    id: post.id,
    slug: post.slug,
    title: plainText(post.title.rendered),
    excerpt: plainText(post.excerpt.rendered),
    content: normalizedContent,
    date: post.date,
    modified: post.modified,
    seoTitle: post.yoast_head_json?.title,
    seoDescription: post.yoast_head_json?.description || undefined,
    image,
  };
}

class MockPostService implements PostService {
  async listPosts() { return { items: [], total: 0, totalPages: 0, unavailable: false }; }
  async getPostBySlug() { return null; }
  async listSitemapPosts() { return []; }
}

export interface PostService {
  listPosts(page: number, pageSize?: number): Promise<{
    items: BlogPost[];
    total: number;
    totalPages: number;
    unavailable?: boolean;
  }>;
  getPostBySlug(slug: string): Promise<BlogPost | null>;
  listSitemapPosts(): Promise<BlogPostSitemapEntry[]>;
}

class WordPressPostService implements PostService {
  async listPosts(page: number, pageSize = 20) {
    let total = 0;
    let totalPages = 0;
    let posts: WordPressPost[];
    try {
      posts = await apiFetch<WordPressPost[]>(apiEndpoints.wordpress.posts, {
        ...postCache(),
        timeoutMs: 15_000,
        onPagination: (count, pages) => { total = count; totalPages = pages; },
        searchParams: {
          page,
          per_page: Math.min(100, Math.max(1, pageSize)),
          orderby: "date",
          order: "desc",
          _fields: postSummaryFields,
        },
      });
    } catch (error) {
      console.error("Creative Hatti blog listing is unavailable.", error);
      return { items: [], total: 0, totalPages: 0, unavailable: true };
    }
    return {
      items: posts.map(mapPost),
      total,
      totalPages,
      unavailable: false,
    };
  }

  async getPostBySlug(slug: string) {
    const posts = await apiFetch<WordPressPost[]>(apiEndpoints.wordpress.posts, {
      ...postCache(slug),
      searchParams: { slug, per_page: 1, _fields: postDetailFields },
    });
    const post = posts[0];
    if (!post) return null;
    // The API WordPress host is globally noindex; its robots metadata must not
    // carry over when these published articles are rendered on the storefront.
    return mapPost(post);
  }

  async listSitemapPosts() {
    const posts = await apiFetch<WordPressPost[]>(apiEndpoints.wordpress.posts, {
      ...postCache(),
      searchParams: {
        per_page: 100,
        orderby: "date",
        order: "desc",
        _fields: "slug,modified,yoast_head_json",
      },
    });
    // Include all published posts. Yoast's noindex metadata is inherited from
    // the API host; the storefront supplies its own canonical and indexable page.
    return posts.map((post) => ({ slug: post.slug, modified: post.modified }));
  }
}

let cached: PostService | null = null;
export function getPostService(): PostService {
  return cached ??= isLiveApiEnabled() ? new WordPressPostService() : new MockPostService();
}
