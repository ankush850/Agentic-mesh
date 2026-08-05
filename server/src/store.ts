import * as fs from "fs";
import * as path from "path";
import type {
  AppVersion,
  FlakyInfo,
  RepairView,
  ReviewRecord,
  RunDetail,
  RunStatus,
  RunStep,
  RunSummary,
  StepStatus,
  TestCase,
  TestResult,
  Ticket,
} from "../../shared/contracts";
import { computeSummary } from "../../src/report/reportBuilder";
import { env } from "./env";

export interface RunConfig {
  baseUrl: string;
  repeat: number;
  appVersion: AppVersion;
  headless: boolean;
  /** When true, auto-create a Jira Bug ticket for permanently failed tests. */
  autoBug?: boolean;
  /** Parent Jira ticket key referenced in auto-created bug descriptions. */
  parentTicketKey?: string;
}

export interface StoredRun {
  summary: RunSummary;
  ticket: Ticket | null;
  testCases: TestCase[];
  tests: TestResult[];
  steps: RunStep[];
  reviews: ReviewRecord[];
  config: RunConfig;
  /** Free-form notes surfaced in the report overview (e.g. cancellation reason). */
  note?: string;
}

const RUN_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export function isValidRunId(runId: string): boolean {
  return RUN_ID_PATTERN.test(runId);
}

export function newRunId(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `run-${stamp}-${suffix}`;
}

export function runDir(runId: string): string {
  if (!isValidRunId(runId)) throw new Error(`Invalid run id: ${runId}`);
  return path.join(env.runsDir, runId);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function emptySummary(partial: {
  runId: string;
  baseUrl: string;
  appVersion: AppVersion;
  repeat: number;
  ticketKey?: string | null;
  ticketTitle?: string | null;
  mock: boolean;
}): RunSummary {
  const now = new Date().toISOString();
  return {
    runId: partial.runId,
    ticketKey: partial.ticketKey ?? null,
    ticketTitle: partial.ticketTitle ?? null,
    baseUrl: partial.baseUrl,
    appVersion: partial.appVersion,
    status: "queued",
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    durationMs: 0,
    repeat: partial.repeat,
    total: 0,
    passed: 0,
    failed: 0,
    healed: 0,
    flaky: 0,
    repairsCount: 0,
    mock: partial.mock,
  };
}

export function createRun(input: {
  summary: RunSummary;
  ticket: Ticket | null;
  testCases: TestCase[];
  config: RunConfig;
}): StoredRun {
  const run: StoredRun = {
    summary: input.summary,
    ticket: input.ticket,
    testCases: input.testCases,
    tests: [],
    steps: input.testCases.flatMap((testCase) =>
      testCase.steps.map((step, stepIndex) => ({
        testId: testCase.id,
        stepIndex,
        description: step.description,
        status: "pending" as StepStatus,
      })),
    ),
    reviews: [],
    config: input.config,
  };
  writeRun(run);
  return run;
}

export function writeRun(run: StoredRun): void {
  const dir = runDir(run.summary.runId);
  ensureDir(dir);
  ensureDir(path.join(dir, "screenshots"));
  const target = path.join(dir, "run.json");
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(run, null, 2), "utf-8");
  fs.renameSync(tmp, target);
  fs.writeFileSync(path.join(dir, "reviews.json"), JSON.stringify(run.reviews, null, 2), "utf-8");
}

export function readRun(runId: string): StoredRun | null {
  if (!isValidRunId(runId)) return null;
  const file = path.join(runDir(runId), "run.json");
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as StoredRun;
    parsed.reviews = parsed.reviews ?? [];
    parsed.steps = parsed.steps ?? [];
    return parsed;
  } catch {
    return null;
  }
}

export function listRuns(): StoredRun[] {
  if (!fs.existsSync(env.runsDir)) return [];
  return fs
    .readdirSync(env.runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isValidRunId(entry.name))
    .map((entry) => readRun(entry.name))
    .filter((run): run is StoredRun => run !== null)
    .sort((a, b) => b.summary.createdAt.localeCompare(a.summary.createdAt));
}

/** Recomputes counts from the collected results (engine `computeSummary` is the source of truth). */
export function reconcileSummary(run: StoredRun): RunSummary {
  const engineSummary = computeSummary(run.tests);
  return {
    ...run.summary,
    total: engineSummary.total,
    passed: engineSummary.passed,
    failed: engineSummary.failed,
    healed: engineSummary.healed,
    flaky: engineSummary.flaky,
    repairsCount: engineSummary.repairsCount,
    durationMs: engineSummary.totalDurationMs,
  };
}

export function deriveStatus(run: StoredRun, cancelled: boolean): RunStatus {
  if (cancelled) return "cancelled";
  if (run.tests.length === 0) return "error";
  return run.tests.some((test) => test.status === "failed") ? "failed" : "passed";
}

export function repairId(runId: string, record: { testId: string; stepIndex: number }): string {
  return `${runId}:${record.testId}:${record.stepIndex}`;
}

/**
 * Rewrites base64 repair screenshots into files inside `runs/<id>/screenshots`
 * and swaps the payloads for artifact URLs the browser can load lazily.
 */
export function persistRepairScreenshots(runId: string, test: TestResult): TestResult {
  const dir = path.join(runDir(runId), "screenshots");
  ensureDir(dir);
  const repairs = test.repairs.map((record, index) => {
    const next = { ...record };
    const write = (kind: "before" | "after", payload?: string): string | undefined => {
      if (!payload || payload.startsWith("/api/")) return payload;
      const file = `repair-${record.testId}-${record.stepIndex}-${index}-${kind}.png`;
      try {
        fs.writeFileSync(path.join(dir, file), Buffer.from(payload, "base64"));
        return `/api/runs/${runId}/artifacts/screenshots/${file}`;
      } catch {
        return undefined;
      }
    };
    next.beforeScreenshot = write("before", record.beforeScreenshot);
    next.afterScreenshot = write("after", record.afterScreenshot);
    return next;
  });
  return { ...test, repairs };
}

/** Appends every repair of a finished run to `runs/<id>/repairs.jsonl`. */
export function appendRepairsLog(run: StoredRun): void {
  const records = run.tests.flatMap((test) => test.repairs);
  if (records.length === 0) return;
  const file = path.join(runDir(run.summary.runId), "repairs.jsonl");
  fs.writeFileSync(
    file,
    records.map((record) => JSON.stringify(record)).join("\n") + "\n",
    "utf-8",
  );
}

export function computeFlaky(tests: TestResult[]): FlakyInfo[] {
  return tests.map((test) => {
    const history = (test.history ?? []).map((entry) => entry as string);
    let transitions = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i] !== history[i - 1]) transitions += 1;
    }
    const score = history.length > 1 ? Math.min(1, transitions / (history.length - 1)) : 0;
    return { testId: test.testId, title: test.title, history, score };
  });
}

export function toRepairViews(run: StoredRun): RepairView[] {
  return run.tests.flatMap((test) =>
    test.repairs.map((record) => {
      const id = repairId(run.summary.runId, record);
      return {
        ...record,
        repairId: id,
        runId: run.summary.runId,
        runTicketKey: run.summary.ticketKey,
        review: run.reviews.find((review) => review.repairId === id) ?? null,
      };
    }),
  );
}

export function toDetail(run: StoredRun): RunDetail {
  return {
    summary: run.summary,
    ticket: run.ticket,
    plannedTests: run.testCases,
    tests: run.tests,
    steps: run.steps,
    repairs: toRepairViews(run),
    flaky: computeFlaky(run.tests),
  };
}

export function saveReview(run: StoredRun, review: ReviewRecord): void {
  run.reviews = [...run.reviews.filter((entry) => entry.repairId !== review.repairId), review];
  writeRun(run);
}
