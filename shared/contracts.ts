/**
 * Agentic-mesh UI contracts.
 *
 * Single source of truth for every request, response and live event that crosses
 * the browser <-> server boundary. Both `server/` and `web/` import from here.
 *
 * Design rules:
 * - The engine types in `src/types.ts` are re-exported (never duplicated as types).
 * - Runtime zod schemas are declared here because `src/types.ts` pulls in heavy
 *   runtime deps (`ai`, `@playwright/test`) that must never reach the browser bundle.
 * - The compile-time guards at the bottom of this file fail the build if the API
 *   shape ever drifts from the engine shape.
 */
import { z } from "zod";
import type { RepairRecord, TestCase, TestCaseStep, TestResult, Ticket } from "../src/types";

// ---------------------------------------------------------------------------
// Engine type re-exports
// ---------------------------------------------------------------------------
export type { RepairRecord, TestCase, TestCaseStep, TestResult, Ticket };

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------
export const APP_VERSION = "1.0.0";
export const RUN_STATUSES = [
  "queued",
  "running",
  "passed",
  "failed",
  "cancelled",
  "error",
] as const;
export const RunStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const AppVersionSchema = z.enum(["v1", "v2"]);
export type AppVersion = z.infer<typeof AppVersionSchema>;

export const ErrorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;

// ---------------------------------------------------------------------------
// Domain: ticket / test cases
// ---------------------------------------------------------------------------
export const TicketSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
});

export const TestCaseStepSchema = z.object({
  description: z.string().min(1),
  data: z.record(z.string(), z.string()).optional(),
  action: z.string().optional(),
  target: z.string().optional(),
  value: z.string().optional(),
  waitUntil: z.string().optional(),
  isScript: z.boolean().optional(),
  script: z.string().optional(),
});

export const TestCaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  criterion: z.string(),
  steps: z.array(TestCaseStepSchema).min(1),
  expectedOutcome: z.string(),
});

// ---------------------------------------------------------------------------
// Domain: results and repairs
// ---------------------------------------------------------------------------
export const TestResultStatusSchema = z.enum(["passed", "failed", "healed", "flaky"]);
export type TestResultStatus = z.infer<typeof TestResultStatusSchema>;

export const RepairRecordSchema = z.object({
  timestamp: z.string(),
  testId: z.string(),
  stepIndex: z.number().int().nonnegative(),
  stepDescription: z.string(),
  oldLocator: z.string(),
  newLocator: z.string(),
  reason: z.string(),
  modelUsed: z.string(),
  confidence: z.number().min(0).max(1),
  /** Base64 payload (engine shape) or an artifact URL (API shape). */
  beforeScreenshot: z.string().optional(),
  afterScreenshot: z.string().optional(),
});

export const TestResultSchema = z.object({
  testId: z.string(),
  title: z.string(),
  criterion: z.string(),
  status: TestResultStatusSchema,
  durationMs: z.number(),
  repairs: z.array(RepairRecordSchema),
  screenshotPath: z.string().optional(),
  error: z.string().optional(),
  stepsExecuted: z.number().optional(),
  history: z.array(z.string()).optional(),
});

export const ReviewDecisionSchema = z.enum(["approved", "rejected", "reverted"]);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const ReviewRecordSchema = z.object({
  repairId: z.string(),
  decision: ReviewDecisionSchema,
  note: z.string().optional(),
  reviewedAt: z.string(),
});
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;

/** A repair as exposed by the API: engine record + run context + review state. */
export const RepairViewSchema = RepairRecordSchema.extend({
  repairId: z.string(),
  runId: z.string(),
  runTicketKey: z.string().nullable(),
  review: ReviewRecordSchema.nullable(),
});
export type RepairView = z.infer<typeof RepairViewSchema>;

// ---------------------------------------------------------------------------
// Domain: runs
// ---------------------------------------------------------------------------
export const RunSummarySchema = z.object({
  runId: z.string().min(1),
  ticketKey: z.string().nullable(),
  ticketTitle: z.string().nullable(),
  baseUrl: z.string(),
  appVersion: AppVersionSchema,
  status: RunStatusSchema,
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  durationMs: z.number(),
  repeat: z.number().int().min(1),
  total: z.number().int(),
  passed: z.number().int(),
  failed: z.number().int(),
  healed: z.number().int(),
  flaky: z.number().int(),
  repairsCount: z.number().int(),
  mock: z.boolean(),
});
export type RunSummary = z.infer<typeof RunSummarySchema>;

export const StepStatusSchema = z.enum(["pending", "running", "passed", "failed", "healed"]);
export type StepStatus = z.infer<typeof StepStatusSchema>;

export const RunStepSchema = z.object({
  testId: z.string(),
  stepIndex: z.number().int().nonnegative(),
  description: z.string(),
  status: StepStatusSchema,
  durationMs: z.number().optional(),
  cached: z.boolean().optional(),
  oldLocator: z.string().optional(),
  newLocator: z.string().optional(),
  error: z.string().optional(),
});
export type RunStep = z.infer<typeof RunStepSchema>;

export const FlakyInfoSchema = z.object({
  testId: z.string(),
  title: z.string(),
  history: z.array(TestResultStatusSchema.or(z.string())),
  score: z.number().min(0).max(1),
});
export type FlakyInfo = z.infer<typeof FlakyInfoSchema>;

export const RunDetailSchema = z.object({
  summary: RunSummarySchema,
  ticket: TicketSchema.nullable(),
  /** The test cases the run was created with (available before results exist). */
  plannedTests: z.array(TestCaseSchema),
  tests: z.array(TestResultSchema),
  steps: z.array(RunStepSchema),
  repairs: z.array(RepairViewSchema),
  flaky: z.array(FlakyInfoSchema),
});
export type RunDetail = z.infer<typeof RunDetailSchema>;

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------
export const FetchTicketRequestSchema = z.object({
  key: z.string().trim().min(1).max(64).optional(),
  useMock: z.boolean().optional(),
});

export const GenerateTestsRequestSchema = z.object({
  ticket: TicketSchema,
  baseUrl: z.string().trim().min(1).optional(),
});

export const CreateRunRequestSchema = z.object({
  testCases: z.array(TestCaseSchema).min(1).max(50),
  baseUrl: z.string().trim().min(1),
  repeat: z.number().int().min(1).max(10).optional(),
  appVersion: AppVersionSchema.optional(),
  ticketKey: z.string().trim().max(64).optional(),
  /** When true the run was launched from the bundled mock ticket; never re-fetch from Jira. */
  useMock: z.boolean().optional(),
  /** Bundled demo page (e.g. "calculator.html") to serve when targeting the demo app. */
  demoPage: z
    .string()
    .trim()
    .regex(/^[\w.-]+\.html$/i, "demoPage must be a .html file name")
    .optional(),
  /** When true, auto-create a Jira Bug ticket for permanently failed tests. */
  autoBug: z.boolean().optional(),
});
export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>;

export const ReviewRequestSchema = z.object({
  decision: ReviewDecisionSchema,
  note: z.string().max(500).optional(),
});

export const DemoAppVersionRequestSchema = z.object({ version: AppVersionSchema });

export const JiraPostRequestSchema = z.object({
  runId: z.string().min(1),
  ticketKey: z.string().trim().min(1).max(64),
  dryRun: z.boolean().optional(),
});

export const SettingsUpdateSchema = z
  .object({
    repeatDefault: z.number().int().min(1).max(10).optional(),
    theme: z.enum(["dark", "light"]).optional(),
    models: z
      .object({
        groq: z.string().trim().max(120).optional(),
        gemini: z.string().trim().max(120).optional(),
      })
      .optional(),
  })
  .strict();

export const RunListQuerySchema = z.object({
  status: RunStatusSchema.optional(),
  ticket: z.string().trim().max(64).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const RepairListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "reverted"]).optional(),
  runId: z.string().optional(),
  model: z.string().optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
});

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------
export const HealthSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
  mockMode: z.boolean(),
  providers: z.object({ groq: z.boolean(), gemini: z.boolean(), jira: z.boolean() }),
});
export type Health = z.infer<typeof HealthSchema>;

export const CreateRunResponseSchema = z.object({ runId: z.string() });
export const OkResponseSchema = z.object({ ok: z.boolean() });
export const GenerateTestsResponseSchema = z.object({ testCases: z.array(TestCaseSchema) });

export const StatsSchema = z.object({
  totals: z.object({
    runs: z.number().int(),
    tests: z.number().int(),
    passed: z.number().int(),
    failed: z.number().int(),
    healed: z.number().int(),
    flaky: z.number().int(),
    repairs: z.number().int(),
  }),
  passRateTrend: z.array(
    z.object({ runId: z.string(), label: z.string(), passRate: z.number(), createdAt: z.string() }),
  ),
  llmCalls: z.number().int(),
  cacheHits: z.number().int(),
  repairsAutoApproved: z.number().int(),
  estimatedMinutesSaved: z.number(),
});
export type Stats = z.infer<typeof StatsSchema>;

export const SettingsSchema = z.object({
  models: z.object({ groq: z.string(), gemini: z.string() }),
  repeatDefault: z.number().int().min(1).max(10),
  targets: z.array(z.string()),
  theme: z.enum(["dark", "light"]),
  /** Which version of the bundled demo app the server currently serves. */
  demoAppVersion: AppVersionSchema,
});
export type Settings = z.infer<typeof SettingsSchema>;

export const JiraPostResponseSchema = z.object({ preview: z.string(), posted: z.boolean() });

// ---------------------------------------------------------------------------
// Live events (SSE)
// ---------------------------------------------------------------------------
export const RUN_EVENT_TYPES = [
  "run.started",
  "test.started",
  "step.started",
  "step.reasoning",
  "step.passed",
  "step.healing",
  "step.healed",
  "step.failed",
  "test.finished",
  "run.finished",
  "run.error",
  "llm.fallback",
] as const;
export type RunEventType = (typeof RUN_EVENT_TYPES)[number];

/** Payload of every live event, keyed by event type. */
export interface RunEventPayloads {
  "run.started": { totalTests: number };
  "test.started": { testId: string; title: string };
  "step.started": { testId: string; stepIndex: number; description: string };
  "step.reasoning": { testId: string; stepIndex: number; text: string };
  "step.passed": { testId: string; stepIndex: number; durationMs: number; cached: boolean };
  "step.healing": { testId: string; stepIndex: number; reason: string; oldLocator: string };
  "step.healed": {
    testId: string;
    stepIndex: number;
    oldLocator: string;
    newLocator: string;
    modelUsed: string;
    confidence: number;
    screenshotBefore?: string;
    screenshotAfter?: string;
  };
  "step.failed": { testId: string; stepIndex: number; error: string; screenshot?: string };
  "test.finished": { testId: string; status: TestResultStatus; durationMs: number };
  "run.finished": { summary: RunSummary };
  "run.error": { message: string };
  "llm.fallback": { from: string; to: string; reason: string };
}

const envelope = <T extends RunEventType, S extends z.ZodTypeAny>(type: T, data: S) =>
  z.object({
    id: z.string(),
    runId: z.string(),
    ts: z.string(),
    type: z.literal(type),
    data,
  });

export const RunEventSchema = z.discriminatedUnion("type", [
  envelope("run.started", z.object({ totalTests: z.number().int() })),
  envelope("test.started", z.object({ testId: z.string(), title: z.string() })),
  envelope(
    "step.started",
    z.object({ testId: z.string(), stepIndex: z.number().int(), description: z.string() }),
  ),
  envelope(
    "step.reasoning",
    z.object({ testId: z.string(), stepIndex: z.number().int(), text: z.string() }),
  ),
  envelope(
    "step.passed",
    z.object({
      testId: z.string(),
      stepIndex: z.number().int(),
      durationMs: z.number(),
      cached: z.boolean(),
    }),
  ),
  envelope(
    "step.healing",
    z.object({
      testId: z.string(),
      stepIndex: z.number().int(),
      reason: z.string(),
      oldLocator: z.string(),
    }),
  ),
  envelope(
    "step.healed",
    z.object({
      testId: z.string(),
      stepIndex: z.number().int(),
      oldLocator: z.string(),
      newLocator: z.string(),
      modelUsed: z.string(),
      confidence: z.number(),
      screenshotBefore: z.string().optional(),
      screenshotAfter: z.string().optional(),
    }),
  ),
  envelope(
    "step.failed",
    z.object({
      testId: z.string(),
      stepIndex: z.number().int(),
      error: z.string(),
      screenshot: z.string().optional(),
    }),
  ),
  envelope(
    "test.finished",
    z.object({ testId: z.string(), status: TestResultStatusSchema, durationMs: z.number() }),
  ),
  envelope("run.finished", z.object({ summary: RunSummarySchema })),
  envelope("run.error", z.object({ message: z.string() })),
  envelope("llm.fallback", z.object({ from: z.string(), to: z.string(), reason: z.string() })),
]);

/** Union of every live event, derived from the payload map. */
export type RunEvent = {
  [K in RunEventType]: {
    id: string;
    runId: string;
    ts: string;
    type: K;
    data: RunEventPayloads[K];
  };
}[RunEventType];

/** Emitter contract shared by the server, the mock player and the SSE client. */
export type RunEventEmitter = <T extends RunEventType>(type: T, data: RunEventPayloads[T]) => void;

/** Formats a run event as an SSE `data:` frame (single JSON line). */
export function serializeEvent(event: RunEvent): string {
  return `id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
}

// ---------------------------------------------------------------------------
// Compile-time drift guards (fail the build, not production)
// ---------------------------------------------------------------------------
type Assignable<A extends B, B> = A;

export type _TicketContract = Assignable<z.infer<typeof TicketSchema>, Ticket>;
export type _TestCaseStepContract = Assignable<z.infer<typeof TestCaseStepSchema>, TestCaseStep>;
export type _TestCaseContract = Assignable<z.infer<typeof TestCaseSchema>, TestCase>;
export type _RepairContract = Assignable<z.infer<typeof RepairRecordSchema>, RepairRecord>;
export type _TestResultContract = Assignable<z.infer<typeof TestResultSchema>, TestResult>;
