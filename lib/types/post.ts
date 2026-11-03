export interface BlogPostImage {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  modified: string;
  seoTitle?: string;
  seoDescription?: string;
  image?: BlogPostImage;
}

export interface BlogPostSitemapEntry {
  slug: string;
  modified: string;
}
