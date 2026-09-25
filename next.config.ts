import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // RUN 01: no remote imagery yet. Future runs will allow the CDN/S3
    // hosts here, e.g. `{ protocol: "https", hostname: "cdn.creativehatti.com" }`.
    remotePatterns: [],
  },
  async redirects() {
    return [
      // Canonical category URLs live at /category/[slug]; keep the legacy
      // plural prefix working for any shared/bookmarked links.
      {
        source: "/categories/:slug",
        destination: "/category/:slug",
        permanent: true,
      },
      // Product pages moved to the singular /product/[slug] (RUN 07);
      // keep the old plural prefix working for shared links.
      {
        source: "/products/:slug",
        destination: "/product/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
