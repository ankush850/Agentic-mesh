import type { FastifyInstance } from "fastify";
import { APP_VERSION, type Health } from "../../../shared/contracts";
import { env, providerStatus } from "../env";
import { queueState } from "../orchestrator";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (): Promise<Health & { queue: { busy: boolean; pending: number } }> => ({
    ok: true,
    version: APP_VERSION,
    mockMode: env.mockMode,
    providers: providerStatus(),
    queue: queueState(),
  }));
}
