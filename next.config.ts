import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // RUN 01: no remote imagery yet. Future runs will allow the CDN/S3
    // hosts here, e.g. `{ protocol: "https", hostname: "cdn.creativehatti.com" }`.
    remotePatterns: [],
  },
};

export default nextConfig;
