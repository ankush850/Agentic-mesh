import { Page } from "playwright";
import { logger } from "../logger";

export interface ChaosConfig {
  throttleNetwork?: boolean;
  injectLatencyMs?: number;
  fuzzDirtyInputs?: boolean;
}

export async function attachChaosMonkey(page: Page, config: ChaosConfig = { throttleNetwork: true, injectLatencyMs: 300 }) {
  logger.info({ config }, "Attaching Autonomous UI Chaos Monkey to Playwright session");

  if (config.throttleNetwork) {
    await page.route("**/*", async (route) => {
      // Intentionally delay responses slightly to stress-test async race conditions
      if (config.injectLatencyMs) {
        await new Promise((r) => setTimeout(r, config.injectLatencyMs));
      }
      await route.continue();
    });
  }
}

export const DIRTY_FUZZ_INPUTS = [
  "'; DROP TABLE users; --",
  "<script>alert(1)</script>",
  "🚀🎉🔥💯",
  "A".repeat(5000), // Buffer overflow attempt
  "NaN",
  "undefined",
  "null",
];
