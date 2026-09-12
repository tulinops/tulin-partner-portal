import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default is 1MB; site-visit photo uploads need headroom for up to
    // ~8MB images (validated server-side in uploadSitePhoto).
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
