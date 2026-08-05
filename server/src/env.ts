import * as path from "path";
import * as os from "os";

/** Repository root (server/src -> server -> repo). */
export const REPO_ROOT = path.resolve(__dirname, "../..");

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "127.0.0.1",
  mockMode: bool(process.env.UI_MOCK),
  runsDir: process.env.RUNS_DIR ? path.resolve(process.env.RUNS_DIR) : path.join(REPO_ROOT, "runs"),
  demoAppPath: path.join(REPO_ROOT, "demo", "index.html"),
  /** Directory holding uploaded demo pages outside the project repository. */
  demoDir: process.env.DEMO_DIR ? path.resolve(process.env.DEMO_DIR) : path.join(os.tmpdir(), "agentic-mesh-demos"),
  fixturesDir: path.join(REPO_ROOT, "fixtures"),
  /** When true the runner launches a visible browser. */
  headed: bool(process.env.UI_HEADED),
  /**
   * Target allowlist. Comma separated origins. `ALLOWED_TARGETS` deliberately
   * replaces the defaults so a deployment can lock this down completely.
   */
  allowedTargets: (process.env.ALLOWED_TARGETS ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean),
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 240),
};

/** Default safe targets, always available unless ALLOWED_TARGETS overrides them. */
export const DEFAULT_TARGETS = [
  "http://localhost",
  "http://127.0.0.1",
  "https://www.saucedemo.com",
  "https://saucedemo.com",
];

/** file:// URL of the bundled demo app, optionally in refactored (v2) mode. */
export function demoAppUrl(version: "v1" | "v2" = "v1"): string {
  const posix = env.demoAppPath.replace(/\\/g, "/");
  return version === "v2" ? `file:///${posix}?v=2` : `file:///${posix}`;
}

export function providerStatus() {
  return {
    groq: Boolean(process.env.GROQ_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    jira: Boolean(
      process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN,
    ),
  };
}
