import * as fs from "fs";
import * as path from "path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CreateRunRequestSchema,
  RunListQuerySchema,
  serializeEvent,
  type AppVersion,
} from "../../../shared/contracts";
import { buildHtmlReport, buildMarkdownReport } from "../../../src/report/reportBuilder";
import { JiraClient, loadMockTicket } from "../../../src/jira/jiraClient";
import { demoAppUrl, env, providerStatus } from "../env";
import { eventBus } from "../events";
import { parse, notFound, badRequest } from "../http";
import { buildMockRun } from "../mock/fixtures";
import { cancelRun, enqueueRun } from "../orchestrator";
import { setDemoAppVersion, getSettings } from "../settings";
import { assertAllowedTarget, resolveInside } from "../security";
import {
  createRun,
  emptySummary,
  listRuns,
  newRunId,
  readRun,
  runDir,
  toDetail,
  writeRun,
} from "../store";

const IdParamsSchema = z.object({ id: z.string().min(1).max(64) });
const ExportQuerySchema = z.object({ format: z.enum(["html", "md", "json"]).default("html") });

export default async function runRoutes(app: FastifyInstance) {
  app.get("/runs", async (request) => {
    const query = parse(RunListQuerySchema, request.query ?? {});
    return listRuns()
      .map((run) => run.summary)
      .filter((summary) => (query.status ? summary.status === query.status : true))
      .filter((summary) =>
        query.ticket
          ? `${summary.ticketKey ?? ""} ${summary.ticketTitle ?? ""}`
              .toLowerCase()
              .includes(query.ticket.toLowerCase())
          : true,
      )
      .filter((summary) => (query.from ? summary.createdAt >= query.from : true))
      .filter((summary) => (query.to ? summary.createdAt <= query.to : true));
  });

  app.post("/runs", async (request) => {
    const body = parse(CreateRunRequestSchema, request.body);
    const settings = getSettings();
    const appVersion = body.appVersion ?? settings.demoAppVersion;
    const isDemo = body.baseUrl.startsWith("file:");
    const baseUrl = isDemo ? resolveDemoUrl(appVersion, body.demoPage) : body.baseUrl;
    assertAllowedTarget(baseUrl);

    if (isDemo && (!body.demoPage || body.demoPage === "index.html")) {
      setDemoAppVersion(appVersion);
    }

    const repeat = body.repeat ?? settings.repeatDefault;
    const ticket = await resolveTicket(body.ticketKey, body.useMock);
    const runId = newRunId();

    if (env.mockMode) {
      const perTest = body.testCases.map((_, index) =>
        index % 4 === 1 ? "healed" : index % 4 === 3 ? "failed" : "passed",
      );
      const mockRun = buildMockRun({
        runId,
        createdAt: new Date().toISOString(),
        appVersion,
        repeat,
        baseUrl,
        perTest: perTest.length > 0 ? perTest : ["healed"],
        testCases: body.testCases,
        ticket: ticket ?? undefined,
      });
      writeRun(mockRun);
    } else {
      createRun({
        summary: emptySummary({
          runId,
          baseUrl,
          appVersion,
          repeat,
          ticketKey: ticket?.key ?? body.ticketKey ?? null,
          ticketTitle: ticket?.title ?? null,
          mock: false,
        }),
        ticket,
        testCases: body.testCases,
        config: { baseUrl, repeat, appVersion, headless: !env.headed, autoBug: body.autoBug ?? true, parentTicketKey: ticket?.key ?? body.ticketKey ?? undefined },
      });
    }

    enqueueRun(runId);
    return { runId };
  });

  app.get("/runs/:id", async (request) => {
    const { id } = parse(IdParamsSchema, request.params);
    const run = readRun(id);
    if (!run) throw notFound("Run");
    return toDetail(run);
  });

  app.post("/runs/:id/cancel", async (request) => {
    const { id } = parse(IdParamsSchema, request.params);
    if (!readRun(id)) throw notFound("Run");
    cancelRun(id);
    return { ok: true };
  });

  app.get("/runs/:id/events", async (request, reply) => {
    const { id } = parse(IdParamsSchema, request.params);
    if (!readRun(id)) throw notFound("Run");

    const headerId = request.headers["last-event-id"];
    const query = request.query as { lastEventId?: string };
    const lastId = typeof headerId === "string" ? headerId : query.lastEventId;

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.write(": connected\n\n");

    for (const event of eventBus.read(id, lastId)) {
      reply.raw.write(serializeEvent(event));
    }

    if (eventBus.isTerminal(id)) {
      reply.raw.end();
      return reply;
    }

    let unsubscribe: () => void = () => undefined;
    const heartbeat = setInterval(() => {
      if (!reply.raw.writableEnded) reply.raw.write(": ping\n\n");
    }, 15_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    unsubscribe = eventBus.subscribe(id, (event) => {
      if (reply.raw.writableEnded) return;
      reply.raw.write(serializeEvent(event));
      if (event.type === "run.finished" || event.type === "run.error") {
        cleanup();
        reply.raw.end();
      }
    });

    request.raw.on("close", cleanup);
    return reply;
  });

  app.get("/runs/:id/artifacts/*", async (request, reply) => {
    const { id } = parse(IdParamsSchema, request.params);
    if (!readRun(id)) throw notFound("Run");

    const wildcard = (request.params as { "*": string })["*"] ?? "";
    const filePath = resolveInside(runDir(id), wildcard);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw notFound("Artifact");
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType =
      extension === ".png"
        ? "image/png"
        : extension === ".webm"
          ? "video/webm"
          : extension === ".json"
            ? "application/json"
            : extension === ".zip"
              ? "application/zip"
              : "text/plain; charset=utf-8";

    reply.header("Content-Type", contentType);
    reply.header("Cache-Control", "private, max-age=300");
    return reply.send(fs.createReadStream(filePath));
  });

  app.get("/runs/:id/export", async (request, reply) => {
    const { id } = parse(IdParamsSchema, request.params);
    const run = readRun(id);
    if (!run) throw notFound("Run");

    const { format } = parse(ExportQuerySchema, request.query ?? {});
    const extension = format === "md" ? "md" : format;
    const filename = `agentic-mesh-${id}.${extension}`;
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);

    if (format === "html") {
      return reply
        .type("text/html; charset=utf-8")
        .send(buildHtmlReport(run.tests, run.ticket ?? undefined));
    }
    if (format === "md") {
      return reply
        .type("text/markdown; charset=utf-8")
        .send(buildMarkdownReport(run.tests, run.ticket ?? undefined));
    }
    return reply.type("application/json").send(toDetail(run));
  });
}

/**
 * Builds the target URL for a bundled demo run. `index.html` keeps the original
 * file:// flow (so the v1/v2 self-healing demo is unchanged); any other page is
 * served over HTTP from the API server so each ticket can drive its own UI.
 */
function resolveDemoUrl(appVersion: AppVersion, demoPage?: string): string {
  const host = env.host === "0.0.0.0" ? "127.0.0.1" : env.host;
  if (!demoPage || demoPage === "index.html") {
    if (fs.existsSync(env.demoAppPath)) {
      return demoAppUrl(appVersion);
    }
  }
  return `http://${host}:${env.port}/demo/${demoPage || "Croupt.html"}`;
}

async function resolveTicket(ticketKey?: string, useMock = false) {
  const jiraAvailable = providerStatus().jira && !env.mockMode;

  // A real ticket key with Jira configured must never silently fall back to the mock.
  if (ticketKey && jiraAvailable && !useMock) {
    try {
      return await new JiraClient({ strict: true }).fetchTicket(ticketKey);
    } catch (error) {
      throw badRequest(
        error instanceof Error ? error.message : `Could not fetch Jira ticket ${ticketKey}`,
        "jira_fetch_failed",
      );
    }
  }

  try {
    const mock = loadMockTicket(path.join(env.fixturesDir, "mock-ticket.json"));
    return ticketKey ? { ...mock, key: ticketKey } : mock;
  } catch {
    return null;
  }
}
