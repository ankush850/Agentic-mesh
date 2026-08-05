import { z } from "zod";
import {
  AppVersionSchema,
  CreateRunResponseSchema,
  GenerateTestsResponseSchema,
  HealthSchema,
  JiraPostResponseSchema,
  OkResponseSchema,
  RepairViewSchema,
  RunDetailSchema,
  RunSummarySchema,
  SettingsSchema,
  StatsSchema,
  TicketSchema,
  type AppVersion,
  type CreateRunRequest,
  type Health,
  type RepairView,
  type ReviewDecision,
  type RunDetail,
  type RunSummary,
  type Settings,
  type Stats,
  type TestCase,
  type Ticket,
} from "../../../shared/contracts";

const BASE = "/api";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch (error) {
    throw new ApiClientError("network_error", (error as Error).message);
  }

  if (!response.ok) {
    let code = `http_${response.status}`;
    let message = response.statusText || "Request failed";
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // keep the status text
    }
    throw new ApiClientError(code, message, response.status);
  }

  const json: unknown = await response.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiClientError(
      "contract_mismatch",
      `Unexpected response from ${path}: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`,
    );
  }
  return parsed.data;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const suffix = search.toString();
  return suffix ? `?${suffix}` : "";
}

export const api = {
  health: () =>
    request<Health & { queue?: { busy: boolean; pending: number } }>(
      "/health",
      HealthSchema.extend({
        queue: z.object({ busy: z.boolean(), pending: z.number() }).optional(),
      }),
    ),

  fetchTicket: (body: { key?: string; useMock?: boolean }) =>
    request<Ticket>("/ticket/fetch", TicketSchema, { method: "POST", body: JSON.stringify(body) }),

  demoPages: () =>
    request<{ pages: string[] }>("/demo-pages", z.object({ pages: z.array(z.string()) })),

  uploadDemoPage: (body: { filename: string; content: string }) =>
    request<{ page: string }>("/demo/upload", z.object({ page: z.string() }), {
      method: "POST",
      body: JSON.stringify(body),
    }),

  generateTests: (body: { ticket: Ticket; baseUrl?: string }) =>
    request<{ testCases: TestCase[] }>("/tests/generate", GenerateTestsResponseSchema, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createRun: (body: CreateRunRequest) =>
    request<{ runId: string }>("/runs", CreateRunResponseSchema, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listRuns: (params: { status?: string; ticket?: string; from?: string; to?: string } = {}) =>
    request<RunSummary[]>(`/runs${query(params)}`, z.array(RunSummarySchema)),

  getRun: (runId: string) => request<RunDetail>(`/runs/${runId}`, RunDetailSchema),

  cancelRun: (runId: string) =>
    request<{ ok: boolean }>(`/runs/${runId}/cancel`, OkResponseSchema, {
      method: "POST",
      body: "{}",
    }),

  listRepairs: (
    params: { status?: string; runId?: string; model?: string; minConfidence?: number } = {},
  ) => request<RepairView[]>(`/repairs${query(params)}`, z.array(RepairViewSchema)),

  reviewRepair: (repairId: string, decision: ReviewDecision, note?: string) =>
    request<RepairView>(`/repairs/${encodeURIComponent(repairId)}/review`, RepairViewSchema, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),

  stats: () => request<Stats>("/stats", StatsSchema),

  settings: () => request<Settings>("/settings", SettingsSchema),

  updateSettings: (body: Partial<Settings>) =>
    request<Settings>("/settings", SettingsSchema, { method: "PUT", body: JSON.stringify(body) }),

  setDemoAppVersion: (version: AppVersion) =>
    request<{ version: AppVersion }>("/demo/app-version", z.object({ version: AppVersionSchema }), {
      method: "POST",
      body: JSON.stringify({ version }),
    }),

  generateRepoTicket: (body: { url?: string; localPath?: string; focus?: string; dryRun?: boolean }) =>
    request<{
      ticket: {
        key: string;
        summary: string;
        title?: string;
        description: string;
        acceptanceCriteria: string[];
        labels: string[];
        evidence: Array<{ criterionIndex: number; elements: string[]; source: string }>;
        contentHash: string;
        reviewNotice: string;
      };
      appModelSummary: {
        pagesCount: number;
        componentsCount: number;
        elementsCount: number;
      };
    }>("/repo/ticket", z.any(), {
      method: "POST",
      body: JSON.stringify(body),
    }),

  connectRepo: (body: {
    url?: string;
    localPath?: string;
    generateTicket?: boolean;
    ticketKey?: string;
    mutate?: boolean;
    confirmUntrusted?: boolean;
    dryRun?: boolean;
    autoBug?: boolean;
  }) =>
    request<any>("/repo/connect", z.any(), {
      method: "POST",
      body: JSON.stringify(body),
    }),

  postToJira: (body: { runId: string; ticketKey: string; dryRun?: boolean }) =>
    request<{ preview: string; posted: boolean }>("/jira/post-result", JiraPostResponseSchema, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  exportUrl: (runId: string, format: "html" | "md" | "json") =>
    `${BASE}/runs/${runId}/export?format=${format}`,
};

/** Normalises engine artifact paths (absolute API paths and data URLs pass through). */
export function artifactUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("/api/") || path.startsWith("data:")) return path;
  return `${BASE}/${path.replace(/^[/\\]+/, "").replace(/\\/g, "/")}`;
}
