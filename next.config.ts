import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Product CDN. `next/image` optimizes, resizes and caches these at
    // the edge; placeholders still render while running on mock data.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.creativehatti.com" },
    ],
  },
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // No X-Frame-Options here: framing policy ships as `frame-ancestors`
      // at the edge/CDN in production (this app also runs embedded in
      // authenticated preview shells during development).
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];
    // HSTS only in production — never on local http.
    if (process.env.NODE_ENV === "production") {
      security.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [{ source: "/:path*", headers: security }];
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
      // Bare plural prefixes: the catalogue browse surface is /search
      // and category discovery lives on the homepage.
      {
        source: "/products",
        destination: "/search",
        permanent: true,
      },
      {
        source: "/categories",
        destination: "/",
        permanent: true,
      },
      // The wishlist is account-scoped; guests bounce to login.
      {
        source: "/wishlist",
        destination: "/account/wishlist",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
