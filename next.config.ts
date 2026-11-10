import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Separate output folder for a check build next to a running `next dev` (they must not share .next)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
