import * as path from "path";
import type { RunEvent, RunEventEmitter, RunStep } from "../../shared/contracts";
import { AgenticMeshRunner } from "../../src/runner/sentinelRunner";
import { logger } from "../../src/logger";
import { env } from "./env";
import { eventBus } from "./events";
import { playMockRun } from "./mock/play";
import {
  appendRepairsLog,
  deriveStatus,
  persistRepairScreenshots,
  readRun,
  reconcileSummary,
  runDir,
  writeRun,
  type StoredRun,
} from "./store";

type Emit = RunEventEmitter;

const queue: string[] = [];
const cancelled = new Set<string>();
let busy = false;

export function enqueueRun(runId: string): void {
  queue.push(runId);
  logger.info({ runId, queued: queue.length }, "Run queued");
  void pump();
}

/** Marks a run as cancelled. Queued runs are dropped; active runs stop between steps. */
export function cancelRun(runId: string): boolean {
  const queuedAt = queue.indexOf(runId);
  if (queuedAt >= 0) {
    queue.splice(queuedAt, 1);
  }
  cancelled.add(runId);
  const run = readRun(runId);
  if (run && run.summary.status === "queued") {
    run.summary.status = "cancelled";
    run.summary.finishedAt = new Date().toISOString();
    writeRun(run);
    eventBus.emit(runId, "run.finished", { summary: run.summary });
  }
  return true;
}

export function isCancelled(runId: string): boolean {
  return cancelled.has(runId);
}

export function queueState(): { busy: boolean; pending: number } {
  return { busy, pending: queue.length };
}

async function pump(): Promise<void> {
  if (busy) return;
  const runId = queue.shift();
  if (!runId) return;
  busy = true;
  try {
    await executeRun(runId);
  } catch (err) {
    logger.error({ err, runId }, "Run execution crashed");
    const run = readRun(runId);
    if (run) {
      run.summary.status = "error";
      run.summary.finishedAt = new Date().toISOString();
      writeRun(run);
    }
    eventBus.emit(runId, "run.error", { message: (err as Error).message });
  } finally {
    cancelled.delete(runId);
    busy = false;
    void pump();
  }
}

function stepKey(testId: string, stepIndex: number): string {
  return `${testId}:${stepIndex}`;
}

/** Executes one run end to end, streaming events to the bus. */
export async function executeRun(runId: string): Promise<void> {
  const run = readRun(runId);
  if (!run) {
    logger.warn({ runId }, "Run not found for execution");
    return;
  }

  const emit: Emit = (type, data) => {
    eventBus.emit(runId, type, data);
  };

  run.summary.status = "running";
  run.summary.startedAt = new Date().toISOString();
  writeRun(run);

  const cancelledNow = await (run.summary.mock
    ? playMockRun(run, emit, {
        isCancelled: () => isCancelled(runId),
        onProgress: (progress) => writeRun(progress),
      })
    : runWithEngine(run, emit));

  run.summary = {
    ...reconcileSummary(run),
    status: deriveStatus(run, cancelledNow || isCancelled(runId)),
    startedAt: run.summary.startedAt,
    finishedAt: new Date().toISOString(),
  };
  appendRepairsLog(run);
  writeRun(run);
  emit("run.finished", { summary: run.summary });
  logger.info({ runId, status: run.summary.status }, "Run finished");
}

/** Runs the real Playwright engine, translating hooks into SSE events. */
async function runWithEngine(run: StoredRun, emit: Emit): Promise<boolean> {
  const runId = run.summary.runId;
  const stepTimers = new Map<string, number>();
  const steps = new Map<string, RunStep>(
    run.steps.map((step) => [stepKey(step.testId, step.stepIndex), step]),
  );

  const patchStep = (testId: string, stepIndex: number, patch: Partial<RunStep>) => {
    const key = stepKey(testId, stepIndex);
    const existing = steps.get(key) ?? {
      testId,
      stepIndex,
      description: "",
      status: "pending" as const,
    };
    const next = { ...existing, ...patch };
    steps.set(key, next);
    run.steps = Array.from(steps.values());
  };

  const runner = new AgenticMeshRunner({
    baseUrl: run.config.baseUrl,
    headless: run.config.headless && !env.headed,
    repeatCount: run.config.repeat,
    screenshotDir: path.join(runDir(runId), "screenshots"),
    autoBug: run.config.autoBug ?? false,
    parentTicketKey: run.config.parentTicketKey,
    hooks: {
      onRunStart: ({ totalTests }) => emit("run.started", { totalTests }),
      onTestStart: ({ testId, title }) => emit("test.started", { testId, title }),
      onStepStart: ({ testId, stepIndex, description }) => {
        stepTimers.set(stepKey(testId, stepIndex), Date.now());
        patchStep(testId, stepIndex, { description, status: "running" });
        emit("step.started", { testId, stepIndex, description });
      },
      onReasoning: ({ testId, stepIndex, text }) =>
        emit("step.reasoning", { testId, stepIndex, text }),
      onStepHealing: (info) => emit("step.healing", info),
      onStepHealed: (info) => {
        patchStep(info.testId, info.stepIndex, {
          status: "healed",
          oldLocator: info.oldLocator,
          newLocator: info.newLocator,
        });
        emit("step.healed", info);
      },
      onStepEnd: ({ testId, stepIndex, durationMs, repaired }) => {
        patchStep(testId, stepIndex, {
          status: repaired ? "healed" : "passed",
          durationMs,
        });
        emit("step.passed", { testId, stepIndex, durationMs, cached: false });
      },
      onStepFailed: ({ testId, stepIndex, error }) => {
        patchStep(testId, stepIndex, { status: "failed", error });
        emit("step.failed", { testId, stepIndex, error });
      },
      onTestEnd: ({ result }) => {
        const persisted = persistRepairScreenshots(runId, result);
        run.tests = [...run.tests.filter((test) => test.testId !== result.testId), persisted];
        writeRun(run);
        emit("test.finished", {
          testId: result.testId,
          status: result.status,
          durationMs: result.durationMs,
        });
      },
      onRunEnd: ({ results }) => {
        run.tests = results.map((result) => persistRepairScreenshots(runId, result));
      },
      isCancelled: () => isCancelled(runId),
    },
  });

  try {
    await runner.runTestCases(run.testCases);
  } finally {
    await runner.close().catch(() => undefined);
  }

  return isCancelled(runId);
}

/** Re-export for tests that need the typed event shape. */
export type { RunEvent };

/** Builds the event emitter bound to a run id (used by route handlers). */
export function emitterFor(runId: string): Emit {
  return (type, data) => eventBus.emit(runId, type, data);
}
