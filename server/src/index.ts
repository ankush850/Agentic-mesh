import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { buildApp } from "./app";
import { env } from "./env";
import { seedRuns } from "./mock/fixtures";
import { listRuns, writeRun } from "./store";
import { logger } from "../../src/logger";

async function main(): Promise<void> {
  fs.mkdirSync(env.runsDir, { recursive: true });

  if (env.mockMode && listRuns().length === 0) {
    for (const run of seedRuns()) writeRun(run);
    logger.info("Mock mode: seeded demo runs");
  }

  const app = await buildApp();
  await app.listen({ port: env.port, host: env.host });

  logger.info(
    { port: env.port, host: env.host, mockMode: env.mockMode, runsDir: env.runsDir },
    `Agentic-mesh API listening on http://${env.host}:${env.port}/api`,
  );
}

main().catch((error) => {
  logger.error({ err: error }, "Server failed to start");
  process.exit(1);
});
