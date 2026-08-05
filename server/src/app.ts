import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { sendError } from "./http";
import { rateLimit } from "./security";
import { env } from "./env";
import healthRoutes from "./routes/health";
import intakeRoutes from "./routes/intake";
import runRoutes from "./routes/runs";
import repairRoutes from "./routes/repairs";
import adminRoutes from "./routes/admin";
import repoRoutes from "./routes/repo";
import remediationRoutes from "./routes/remediation";
import { demoListRoutes, demoStaticRoutes } from "./routes/demo";

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: 8 * 1024 * 1024 });

  // CORS is only useful for local UI development; production serves the SPA
  // and the API from the same origin.
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || LOCAL_ORIGIN.test(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "OPTIONS"],
  });

  app.addHook("onRequest", async (request, reply) => {
    if (!rateLimit(request.ip)) {
      return reply
        .status(429)
        .send({ error: { code: "rate_limited", message: "Too many requests, slow down." } });
    }
  });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation) {
      return reply
        .status(422)
        .send({ error: { code: "validation_error", message: error.message } });
    }
    return sendError(reply, error);
  });

  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(intakeRoutes, { prefix: "/api" });
  await app.register(runRoutes, { prefix: "/api" });
  await app.register(repairRoutes, { prefix: "/api" });
  await app.register(adminRoutes, { prefix: "/api" });
  await app.register(remediationRoutes, { prefix: "/api" });
  await app.register(repoRoutes, { prefix: "/api" });
  await app.register(demoListRoutes, { prefix: "/api" });
  // The demo folder is served at the root so the runner can load any bundled page.
  await app.register(demoStaticRoutes);

  app.get("/api", async () => ({ ok: true, mockMode: env.mockMode }));

  return app;
}
