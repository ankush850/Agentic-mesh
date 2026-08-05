import { HttpResponse, delay, http } from "msw";
import {
  buildMockDetail,
  mockDemoPages,
  mockRepairs,
  mockSettings,
  mockStats,
  mockSummaries,
  mockTestCases,
  mockTicket,
} from "./data";

/**
 * Offline API used when `VITE_MOCK_API=1`. Mirrors the real routes closely
 * enough that every page can be reviewed without any provider keys.
 */

let repairState = [...mockRepairs];
let settings = { ...mockSettings };

export const handlers = [
  http.get("/api/health", async () => {
    await delay(120);
    return HttpResponse.json({
      ok: true,
      version: "1.0.0",
      mockMode: true,
      providers: { groq: false, gemini: false, jira: false },
      queue: { busy: false, pending: 0 },
    });
  }),

  http.get("/api/stats", async () => {
    await delay(160);
    return HttpResponse.json(mockStats);
  }),

  http.get("/api/runs", async ({ request }) => {
    await delay(140);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const ticket = url.searchParams.get("ticket")?.toLowerCase();
    const filtered = mockSummaries
      .filter((run) => (status ? run.status === status : true))
      .filter((run) =>
        ticket
          ? `${run.ticketKey ?? ""} ${run.ticketTitle ?? ""}`.toLowerCase().includes(ticket)
          : true,
      );
    return HttpResponse.json(filtered);
  }),

  http.get("/api/runs/:runId", async ({ params }) => {
    await delay(160);
    return HttpResponse.json(buildMockDetail(String(params.runId)));
  }),

  http.post("/api/runs/:runId/cancel", async () => {
    await delay(120);
    return HttpResponse.json({ ok: true });
  }),

  http.post("/api/runs", async () => {
    await delay(260);
    return HttpResponse.json({ runId: "run-mock-0004" });
  }),

  http.post("/api/ticket/fetch", async () => {
    await delay(180);
    return HttpResponse.json(mockTicket);
  }),

  http.get("/api/demo-pages", async () => {
    await delay(80);
    return HttpResponse.json({ pages: mockDemoPages });
  }),

  http.post("/api/demo/upload", async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as { filename?: string };
    const name = body?.filename || "custom.html";
    if (!mockDemoPages.includes(name)) {
      mockDemoPages.push(name);
    }
    return HttpResponse.json({ page: name });
  }),

  http.post("/api/tests/generate", async () => {
    await delay(420);
    return HttpResponse.json({ testCases: mockTestCases });
  }),

  http.get("/api/repairs", async ({ request }) => {
    await delay(140);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const model = url.searchParams.get("model");
    const minConfidence = Number(url.searchParams.get("minConfidence") ?? 0);
    const filtered = repairState
      .filter((repair) => {
        if (!status) return true;
        if (status === "pending") return repair.review === null;
        return repair.review?.decision === status;
      })
      .filter((repair) => (model ? repair.modelUsed === model : true))
      .filter((repair) => (minConfidence ? repair.confidence >= minConfidence : true));
    return HttpResponse.json(filtered);
  }),

  http.post("/api/repairs/:repairId/review", async ({ params, request }) => {
    await delay(180);
    const repairId = decodeURIComponent(String(params.repairId));
    const body = (await request.json()) as {
      decision: "approved" | "rejected" | "reverted";
      note?: string;
    };
    const index = repairState.findIndex((repair) => repair.repairId === repairId);
    if (index === -1)
      return HttpResponse.json(
        { error: { code: "not_found", message: "Repair not found" } },
        { status: 404 },
      );

    const updated = {
      ...repairState[index],
      review: {
        repairId,
        decision: body.decision,
        note: body.note,
        reviewedAt: new Date().toISOString(),
      },
    };
    repairState = repairState.map((repair, i) => (i === index ? updated : repair));
    return HttpResponse.json(updated);
  }),

  http.get("/api/settings", async () => {
    await delay(100);
    return HttpResponse.json(settings);
  }),

  http.put("/api/settings", async ({ request }) => {
    await delay(120);
    const patch = (await request.json()) as Partial<typeof settings>;
    settings = { ...settings, ...patch, models: { ...settings.models, ...patch.models } };
    return HttpResponse.json(settings);
  }),

  http.post("/api/demo/app-version", async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as { version: "v1" | "v2" };
    settings = { ...settings, demoAppVersion: body.version };
    return HttpResponse.json({ version: body.version });
  }),

  http.post("/api/jira/post-result", async ({ request }) => {
    await delay(220);
    const body = (await request.json()) as { runId: string; ticketKey: string; dryRun?: boolean };
    const summary = mockSummaries.find((run) => run.runId === body.runId) ?? mockSummaries[0];
    const preview = [
      `*Agentic-mesh autonomous run* ${body.runId}`,
      `Ticket: ${body.ticketKey} | Target: ${summary.baseUrl} (demo ${summary.appVersion})`,
      `Total: ${summary.total} | Passed: ${summary.passed} | Healed: ${summary.healed} | Failed: ${summary.failed}`,
    ].join("\n");
    return HttpResponse.json({ preview, posted: false });
  }),

  // SSE cannot be served by MSW's fetch interceptor; the live view falls back to polling.
  http.get("/api/runs/:runId/events", async () => {
    await delay(50);
    return new HttpResponse(null, { status: 204 });
  }),
];
