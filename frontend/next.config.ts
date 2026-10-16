import path from "node:path";
import type { NextConfig } from "next";

// The app reads ../templates, so the repo root is the project root.
const repoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  // Built as static files that the FastAPI backend serves (see backend/).
  // Trailing slashes emit nda/index.html, which a static file server resolves.
  output: "export",
  trailingSlash: true,
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
