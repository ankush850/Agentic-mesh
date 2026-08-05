import type { RunEventEmitter, RunStep, StepStatus } from "../../../shared/contracts";
import { reconcileSummary, type StoredRun } from "../store";

type Emit = RunEventEmitter;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface MockPlaybackOptions {
  isCancelled: () => boolean;
  onProgress: (run: StoredRun) => void;
  speed?: number;
}

/**
 * Replays a pre-built run as a timed event stream. This is what makes the whole
 * UI demoable with `UI_MOCK=1` — no LLM keys, no Jira, no browser.
 * Returns true when the run was cancelled mid-flight.
 */
export async function playMockRun(
  run: StoredRun,
  emit: Emit,
  options: MockPlaybackOptions,
): Promise<boolean> {
  const speed = options.speed ?? 1;
  const wait = (ms: number) => sleep(Math.round(ms / speed));
  emit("run.started", { totalTests: run.tests.length });

  for (const test of run.tests) {
    if (options.isCancelled()) return true;

    const testSteps = run.steps.filter((step) => step.testId === test.testId);
    // Capture the scripted outcome before resetting, otherwise every step replays as "pending".
    const intendedByStep = new Map(testSteps.map((step) => [step.stepIndex, step.status]));
    for (const step of testSteps) {
      step.status = "pending";
      step.durationMs = undefined;
    }
    emit("test.started", { testId: test.testId, title: test.title });
    options.onProgress(run);
    await wait(180);

    for (const step of testSteps) {
      if (options.isCancelled()) return true;
      const intended: StepStatus = intendedByStep.get(step.stepIndex) ?? "passed";
      await playStep(step, intended, test.testId, emit, wait, options, run);
    }

    emit("test.finished", {
      testId: test.testId,
      status: test.status,
      durationMs: test.durationMs,
    });
    options.onProgress(run);
    await wait(160);
  }

  run.summary = reconcileSummary(run);
  options.onProgress(run);
  // The terminal `run.finished` event is emitted by the orchestrator, once the
  // real status (passed/failed/cancelled) has been derived.
  return options.isCancelled();
}

async function playStep(
  step: RunStep,
  intended: StepStatus,
  testId: string,
  emit: Emit,
  wait: (ms: number) => Promise<void>,
  options: MockPlaybackOptions,
  run: StoredRun,
): Promise<void> {
  step.status = "running";
  options.onProgress(run);
  emit("step.started", { testId, stepIndex: step.stepIndex, description: step.description });
  emit("step.reasoning", {
    testId,
    stepIndex: step.stepIndex,
    text: `Resolving target for step ${step.stepIndex + 1}: ${step.description}`,
  });
  await wait(240);

  const durationMs = 210 + step.stepIndex * 70;
  const repair = run.tests.find((test) => test.testId === testId)?.repairs[0];

  if (intended === "healed" && repair) {
    emit("step.healing", {
      testId,
      stepIndex: step.stepIndex,
      reason: "Locator did not match any element - scanning the DOM for the closest replacement.",
      oldLocator: repair.oldLocator,
    });
    await wait(900);
    emit("step.healed", {
      testId,
      stepIndex: step.stepIndex,
      oldLocator: repair.oldLocator,
      newLocator: repair.newLocator,
      modelUsed: repair.modelUsed,
      confidence: repair.confidence,
      screenshotBefore: repair.beforeScreenshot,
      screenshotAfter: repair.afterScreenshot,
    });
    step.status = "healed";
    step.durationMs = durationMs + 900;
    emit("step.passed", {
      testId,
      stepIndex: step.stepIndex,
      durationMs: step.durationMs,
      cached: false,
    });
  } else if (intended === "failed") {
    step.status = "failed";
    step.durationMs = durationMs;
    emit("step.failed", {
      testId,
      stepIndex: step.stepIndex,
      error: step.error ?? "Step failed: element not found",
    });
  } else {
    step.status = "passed";
    step.durationMs = durationMs;
    emit("step.passed", {
      testId,
      stepIndex: step.stepIndex,
      durationMs,
      cached: Boolean(step.cached),
    });
  }

  options.onProgress(run);
  await wait(120);
}
