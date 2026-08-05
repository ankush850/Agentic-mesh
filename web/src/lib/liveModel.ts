import type {
  RunDetail,
  RunEvent,
  RunStep,
  RunSummary,
  TestResultStatus,
} from "../../../shared/contracts";

export type LiveTestStatus = "pending" | "running" | TestResultStatus;

export interface LiveTest {
  testId: string;
  title: string;
  status: LiveTestStatus;
  durationMs?: number;
  steps: RunStep[];
}

export interface LiveHeal {
  testId: string;
  stepIndex: number;
  oldLocator: string;
  newLocator: string;
  modelUsed: string;
  confidence: number;
  at: string;
}

export interface LiveModel {
  tests: LiveTest[];
  /** testId -> stepIndex -> streamed reasoning lines. */
  reasoning: Record<string, Record<number, string[]>>;
  heals: LiveHeal[];
  summary?: RunSummary;
  error?: string;
  active?: { testId: string; stepIndex: number; description: string };
  lastEventAt?: string;
}

/**
 * Folds persisted run state and streamed events into one view model.
 *
 * Pure on purpose: the live console and its tests share exactly one derivation
 * path, and replaying the same events always produces the same UI.
 */
export function buildLiveModel(detail: RunDetail | undefined, events: RunEvent[]): LiveModel {
  const tests = new Map<string, LiveTest>();

  const ensureTest = (testId: string, title?: string): LiveTest => {
    const existing = tests.get(testId);
    if (existing) {
      if (title) existing.title = title;
      return existing;
    }
    const created: LiveTest = { testId, title: title || testId, status: "pending", steps: [] };
    tests.set(testId, created);
    return created;
  };

  if (detail) {
    for (const planned of detail.plannedTests) ensureTest(planned.id, planned.title);
    for (const result of detail.tests) {
      const test = ensureTest(result.testId, result.title);
      test.status = result.status;
      test.durationMs = result.durationMs;
    }
    for (const step of detail.steps) {
      const test = ensureTest(step.testId);
      if (!test.steps.some((entry) => entry.stepIndex === step.stepIndex)) {
        test.steps.push({ ...step });
      }
    }
  }

  const reasoning: Record<string, Record<number, string[]>> = {};
  const heals: LiveHeal[] = [];
  let summary = detail?.summary;
  let error: string | undefined;
  let active: LiveModel["active"];
  let lastEventAt: string | undefined;

  const upsertStep = (
    test: LiveTest,
    stepIndex: number,
    patch: Partial<RunStep>,
    description?: string,
  ): RunStep => {
    const index = test.steps.findIndex((entry) => entry.stepIndex === stepIndex);
    const base: RunStep = {
      testId: test.testId,
      stepIndex,
      description: description ?? "",
      status: "pending",
    };
    if (index === -1) {
      const next = { ...base, ...patch, ...(description ? { description } : {}) };
      test.steps.push(next);
      return next;
    }
    const merged = { ...test.steps[index], ...patch };
    if (description) merged.description = description;
    test.steps[index] = merged;
    return merged;
  };

  for (const event of events) {
    lastEventAt = event.ts;

    switch (event.type) {
      case "test.started": {
        const test = ensureTest(event.data.testId, event.data.title);
        test.status = "running";
        break;
      }
      case "step.started": {
        const test = ensureTest(event.data.testId);
        test.status = "running";
        upsertStep(test, event.data.stepIndex, { status: "running" }, event.data.description);
        active = {
          testId: event.data.testId,
          stepIndex: event.data.stepIndex,
          description: event.data.description,
        };
        break;
      }
      case "step.reasoning": {
        const test = ensureTest(event.data.testId);
        upsertStep(test, event.data.stepIndex, {});
        const perTest = (reasoning[event.data.testId] ??= {});
        (perTest[event.data.stepIndex] ??= []).push(event.data.text);
        break;
      }
      case "step.healing": {
        const test = ensureTest(event.data.testId);
        upsertStep(test, event.data.stepIndex, {
          status: "running",
          oldLocator: event.data.oldLocator,
        });
        break;
      }
      case "step.healed": {
        const test = ensureTest(event.data.testId);
        upsertStep(test, event.data.stepIndex, {
          status: "healed",
          oldLocator: event.data.oldLocator,
          newLocator: event.data.newLocator,
        });
        heals.push({
          testId: event.data.testId,
          stepIndex: event.data.stepIndex,
          oldLocator: event.data.oldLocator,
          newLocator: event.data.newLocator,
          modelUsed: event.data.modelUsed,
          confidence: event.data.confidence,
          at: event.ts,
        });
        break;
      }
      case "step.passed": {
        const test = ensureTest(event.data.testId);
        const existing = test.steps.find((entry) => entry.stepIndex === event.data.stepIndex);
        // A healed step also emits step.passed; keep the healing status.
        const status = existing?.status === "healed" ? "healed" : "passed";
        upsertStep(test, event.data.stepIndex, {
          status,
          durationMs: event.data.durationMs,
          cached: event.data.cached,
        });
        if (active?.testId === event.data.testId && active.stepIndex === event.data.stepIndex)
          active = undefined;
        break;
      }
      case "step.failed": {
        const test = ensureTest(event.data.testId);
        upsertStep(test, event.data.stepIndex, { status: "failed", error: event.data.error });
        if (active?.testId === event.data.testId && active.stepIndex === event.data.stepIndex)
          active = undefined;
        break;
      }
      case "test.finished": {
        const test = ensureTest(event.data.testId);
        test.status = event.data.status;
        test.durationMs = event.data.durationMs;
        break;
      }
      case "run.started": {
        if (summary)
          summary = { ...summary, total: Math.max(summary.total, event.data.totalTests) };
        break;
      }
      case "run.finished": {
        summary = event.data.summary;
        break;
      }
      case "run.error": {
        error = event.data.message;
        break;
      }
      case "llm.fallback": {
        // Recorded in the reasoning stream by the server; nothing to fold here.
        break;
      }
      default:
        break;
    }
  }

  const ordered = Array.from(tests.values()).map((test) => ({
    ...test,
    steps: [...test.steps].sort((a, b) => a.stepIndex - b.stepIndex),
  }));

  return { tests: ordered, reasoning, heals, summary, error, active, lastEventAt };
}

/** Counts finished tests so the header can show progress without recomputing. */
export function liveProgress(model: LiveModel): { done: number; total: number } {
  const total = model.summary?.total || model.tests.length;
  const done = model.tests.filter(
    (test) => test.status !== "pending" && test.status !== "running",
  ).length;
  return { done, total };
}
