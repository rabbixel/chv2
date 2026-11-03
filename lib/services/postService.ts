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
    robots?: { index?: string };
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
  return {
    id: post.id,
    slug: post.slug,
    title: plainText(post.title.rendered),
    excerpt: plainText(post.excerpt.rendered),
    content: post.content?.rendered ?? "",
    date: post.date,
    modified: post.modified,
    seoTitle: post.yoast_head_json?.title,
    seoDescription: post.yoast_head_json?.description || undefined,
    image,
  };
}

class MockPostService implements PostService {
  async listPosts() { return { items: [], total: 0, totalPages: 0 }; }
  async getPostBySlug() { return null; }
  async listSitemapPosts() { return []; }
}

export interface PostService {
  listPosts(page: number, pageSize?: number): Promise<{
    items: BlogPost[];
    total: number;
    totalPages: number;
  }>;
  getPostBySlug(slug: string): Promise<BlogPost | null>;
  listSitemapPosts(): Promise<BlogPostSitemapEntry[]>;
}

class WordPressPostService implements PostService {
  async listPosts(page: number, pageSize = 20) {
    let total = 0;
    let totalPages = 0;
    const posts = await apiFetch<WordPressPost[]>(apiEndpoints.wordpress.posts, {
      ...postCache(),
      onPagination: (count, pages) => { total = count; totalPages = pages; },
      searchParams: {
        page,
        per_page: Math.min(100, Math.max(1, pageSize)),
        orderby: "date",
        order: "desc",
        _fields: postSummaryFields,
      },
    });
    return {
      items: posts.map(mapPost),
      total,
      totalPages,
    };
  }

  async getPostBySlug(slug: string) {
    const posts = await apiFetch<WordPressPost[]>(apiEndpoints.wordpress.posts, {
      ...postCache(slug),
      searchParams: { slug, per_page: 1, _fields: postDetailFields },
    });
    const post = posts[0];
    if (!post || post.yoast_head_json?.robots?.index === "noindex") return null;
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
    return posts
      .filter((post) => post.yoast_head_json?.robots?.index !== "noindex")
      .map((post) => ({ slug: post.slug, modified: post.modified }));
  }
}

let cached: PostService | null = null;
export function getPostService(): PostService {
  return cached ??= isLiveApiEnabled() ? new WordPressPostService() : new MockPostService();
}
