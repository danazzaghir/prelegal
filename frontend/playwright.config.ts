import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Tests run against the static build served by the FastAPI backend, as in
  // the Docker image. Set UV (e.g. UV="python -m uv") if uv is not on PATH.
  webServer: {
    command: `npm run build && ${process.env.UV ?? "uv"} run --project ../backend prelegal-backend`,
    url: `http://localhost:${port}/api/health`,
    env: {
      PORT: String(port),
      DATABASE_PATH: path.join(os.tmpdir(), "prelegal-e2e", "prelegal.db"),
    },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
