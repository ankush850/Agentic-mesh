import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CreateRunResponseSchema,
  ErrorBodySchema,
  HealthSchema,
  RepairViewSchema,
  RunDetailSchema,
  RunSummarySchema,
  StatsSchema,
  type CreateRunRequest,
  type RepairView,
} from "../../shared/contracts";

/**
 * Contract tests for the Agentic-mesh web API.
 *
 * The real Fastify app runs in `UI_MOCK` mode against a throwaway runs
 * directory, so no browser, LLM key or Jira account is involved. Only the run
 * execution is mocked - every route, zod schema and error envelope under test
 * is the one that ships.
 */
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-mesh-api-"));
process.env.UI_MOCK = "1";
process.env.RUNS_DIR = path.join(tmpRoot, "runs");
process.env.RATE_LIMIT_PER_MINUTE = "100000";
process.env.ALLOWED_TARGETS = "";

const { buildApp } = await import("../../server/src/app");

const TEST_CASES: CreateRunRequest["testCases"] = [
  {
    id: "TC-01",
    title: "Successful login",
    criterion: "Valid credentials show the todo list",
    expectedOutcome: "The todo list is visible",
    steps: [
      { description: "Navigate to the demo app" },
      { description: "Type the username into #username", data: { value: "demo" } },
    ],
  },
  {
    id: "TC-02",
    title: "Add a todo item",
    criterion: "Adding a todo appends it to the list",
    expectedOutcome: "The new todo appears in the list",
    steps: [
      { description: "Navigate to the demo app" },
      { description: "Type a task into #todo-input", data: { value: "Ship it" } },
    ],
  },
];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let app: FastifyInstance;
let runId: string;

async function waitForRun(id: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await app.inject({ method: "GET", url: `/api/runs/${id}` });
    const detail = RunDetailSchema.parse(response.json());
    if (["passed", "failed", "cancelled", "error"].includes(detail.summary.status)) return detail;
    await sleep(100);
  }
  throw new Error(`Run ${id} did not finish within ${timeoutMs}ms`);
}

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("GET /api/health", () => {
  it("reports provider availability and mock mode", async () => {
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);

    const health = HealthSchema.parse(response.json());
    expect(health.ok).toBe(true);
    expect(health.mockMode).toBe(true);
    expect(typeof health.providers.groq).toBe("boolean");
    expect(typeof health.providers.jira).toBe("boolean");
  });
});

describe("run lifecycle", () => {
  it("creates a run and returns only its id", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: {
        testCases: TEST_CASES,
        baseUrl: "file:///demo/index.html",
        repeat: 1,
        ticketKey: "QA-101",
      },
    });
    expect(response.statusCode).toBe(200);

    const created = CreateRunResponseSchema.parse(response.json());
    expect(created.runId).toMatch(/^run-/);
    runId = created.runId;
  });

  it("exposes planned tests, results and steps once the run finishes", async () => {
    const detail = await waitForRun(runId);

    expect(detail.plannedTests.map((test) => test.id)).toEqual(["TC-01", "TC-02"]);
    expect(detail.tests).toHaveLength(2);
    expect(detail.tests.some((test) => test.status === "healed")).toBe(true);
    expect(detail.steps.length).toBeGreaterThanOrEqual(4);
    expect(detail.summary.ticketKey).toBe("QA-101");
  });

  it("lists the finished run", async () => {
    const response = await app.inject({ method: "GET", url: "/api/runs" });
    expect(response.statusCode).toBe(200);

    const summaries = RunSummarySchema.array().parse(response.json());
    expect(summaries.some((summary) => summary.runId === runId)).toBe(true);
  });

  it("replays the event stream with ids so clients can resume", async () => {
    const response = await app.inject({ method: "GET", url: `/api/runs/${runId}/events` });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");

    const events = response.payload
      .split("\n\n")
      .filter((frame) => frame.includes("data:"))
      .map((frame) => {
        const dataLine = frame.split("\n").find((line) => line.startsWith("data:")) ?? "data:";
        return JSON.parse(dataLine.replace(/^data:\s*/, ""));
      });
    expect(events.length).toBeGreaterThan(0);

    const ids = events.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(events.some((event) => event.type === "step.healed")).toBe(true);
    expect(events.at(-1).type).toBe("run.finished");
  });

  it("exports the run as markdown and json", async () => {
    const markdown = await app.inject({ method: "GET", url: `/api/runs/${runId}/export?format=md` });
    expect(markdown.statusCode).toBe(200);
    expect(markdown.headers["content-type"]).toContain("text/markdown");
    expect(markdown.payload).toContain("QA-101");

    const json = await app.inject({ method: "GET", url: `/api/runs/${runId}/export?format=json` });
    expect(json.statusCode).toBe(200);
    expect(RunDetailSchema.parse(json.json()).summary.runId).toBe(runId);
  });

  it("returns a 404 error envelope for unknown runs", async () => {
    const response = await app.inject({ method: "GET", url: "/api/runs/run-does-not-exist" });
    expect(response.statusCode).toBe(404);

    const body = ErrorBodySchema.parse(response.json());
    expect(body.error.code).toBe("not_found");
  });

  it("rejects targets outside the allowlist", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { testCases: TEST_CASES, baseUrl: "https://evil.example.com" },
    });
    expect(response.statusCode).toBe(403);

    const body = ErrorBodySchema.parse(response.json());
    expect(body.error.code).toBe("target_not_allowed");
  });
});

describe("repairs review", () => {
  it("starts with a pending repair and records the decision", async () => {
    const pendingResponse = await app.inject({ method: "GET", url: "/api/repairs?status=pending" });
    expect(pendingResponse.statusCode).toBe(200);

    const pending = RepairViewSchema.array().parse(pendingResponse.json());
    const repair = pending.find((entry) => entry.runId === runId);
    expect(repair).toBeDefined();

    const approve = await app.inject({
      method: "POST",
      url: `/api/repairs/${encodeURIComponent((repair as RepairView).repairId)}/review`,
      payload: { decision: "approved", note: "Matches the refactored markup." },
    });
    expect(approve.statusCode).toBe(200);

    const reviewed = RepairViewSchema.parse(approve.json());
    expect(reviewed.review?.decision).toBe("approved");
    expect(reviewed.review?.note).toBe("Matches the refactored markup.");

    const approvedResponse = await app.inject({ method: "GET", url: "/api/repairs?status=approved" });
    const approved = RepairViewSchema.array().parse(approvedResponse.json());
    expect(approved.some((entry) => entry.repairId === reviewed.repairId)).toBe(true);
  });

  it("rejects malformed repair ids", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/repairs/not-a-repair-id/review",
      payload: { decision: "approved" },
    });
    expect(response.statusCode).toBe(400);
    expect(ErrorBodySchema.parse(response.json()).error.code).toBe("bad_request");
  });
});

describe("stats and settings", () => {
  it("aggregates totals from stored runs", async () => {
    const response = await app.inject({ method: "GET", url: "/api/stats" });
    expect(response.statusCode).toBe(200);

    const stats = StatsSchema.parse(response.json());
    expect(stats.totals.runs).toBeGreaterThanOrEqual(1);
    expect(stats.passRateTrend.length).toBeGreaterThanOrEqual(1);
  });

  it("updates and returns settings", async () => {
    const updated = await app.inject({
      method: "PUT",
      url: "/api/settings",
      payload: { theme: "light", repeatDefault: 3 },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().repeatDefault).toBe(3);
    expect(updated.json().demoAppVersion).toMatch(/^v[12]$/);

    const fetched = await app.inject({ method: "GET", url: "/api/settings" });
    expect(fetched.json().theme).toBe("light");
  });

  it("switches the demo app version", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/demo/app-version",
      payload: { version: "v2" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().version).toBe("v2");
  });

  it("dry-runs the Jira post so nothing leaves the machine", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/jira/post-result",
      payload: { runId, ticketKey: "QA-101", dryRun: true },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().posted).toBe(false);
  });
});
