import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app is fully dynamic (per-viewer tokens, live comments), so Cache
  // Components is left off to keep cookie/header access straightforward.
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
