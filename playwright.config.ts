import * as fs from "fs";
import * as path from "path";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end test for the web console.
 *
 * Both servers run in UI_MOCK mode: no LLM keys, no Jira account and no real
 * browser automation inside the app, so the suite is deterministic and can run
 * on any machine. The runs directory is wiped on every invocation.
 */
const API_PORT = Number(process.env.E2E_API_PORT ?? 8799);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5183);
const RUNS_DIR = path.resolve(__dirname, ".e2e-runs");

// The API binds 127.0.0.1; Vite binds `localhost` (::1 on Windows), so the two
// URLs are deliberately different.
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

fs.rmSync(RUNS_DIR, { recursive: true, force: true });

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npx tsx server/src/index.ts",
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        UI_MOCK: "1",
        PORT: String(API_PORT),
        HOST: "127.0.0.1",
        RUNS_DIR,
        RATE_LIMIT_PER_MINUTE: "10000",
      },
    },
    {
      command: `npm --prefix web run dev -- --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        UI_API_URL: API_URL,
      },
    },
  ],
});
