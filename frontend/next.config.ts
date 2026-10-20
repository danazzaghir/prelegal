import path from "node:path";
import type { NextConfig } from "next";

// The app reads ../templates, so the repo root is the project root.
const repoRoot = path.join(__dirname, "..");
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // Built as static files that the FastAPI backend serves (see backend/).
  // Trailing slashes emit nda/index.html, which a static file server resolves.
  output: "export",
  trailingSlash: true,
  outputFileTracingRoot: repoRoot,
  // In `next dev`, send API calls to the backend (start it with `uv run prelegal-backend`).
  // The static build is served by the backend itself, so it needs no rewrites.
  // Skipping the trailing-slash redirect stops `/api/chat` becoming `/api/chat/` first.
  ...(process.env.NODE_ENV === "development" && {
    skipTrailingSlashRedirect: true,
    rewrites: async () => [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }],
  }),
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
