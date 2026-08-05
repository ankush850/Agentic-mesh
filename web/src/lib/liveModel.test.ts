import { describe, expect, it } from "vitest";
import type {
  RunDetail,
  RunEvent,
  RunEventPayloads,
  RunEventType,
  RunSummary,
  TestCase,
} from "../../../shared/contracts";
import { buildLiveModel, liveProgress } from "./liveModel";

const summary: RunSummary = {
  runId: "run-1",
  ticketKey: "QA-101",
  ticketTitle: "Login flow",
  baseUrl: "file:///demo/index.html",
  appVersion: "v1",
  status: "running",
  createdAt: "2026-01-01T00:00:00.000Z",
  startedAt: "2026-01-01T00:00:01.000Z",
  finishedAt: null,
  durationMs: 0,
  repeat: 1,
  total: 2,
  passed: 0,
  failed: 0,
  healed: 0,
  flaky: 0,
  repairsCount: 0,
  mock: true,
};

const planned: TestCase[] = [
  {
    id: "TC-01",
    title: "Successful login",
    criterion: "Valid credentials show the todo list",
    expectedOutcome: "The todo list is visible",
    steps: [{ description: "Navigate" }, { description: "Fill the form" }],
  },
  {
    id: "TC-02",
    title: "Add a todo",
    criterion: "Adding a todo appends it to the list",
    expectedOutcome: "The new todo appears",
    steps: [{ description: "Navigate" }, { description: "Type a task" }],
  },
];

const detail: RunDetail = {
  summary,
  ticket: null,
  plannedTests: planned,
  tests: [],
  steps: [],
  repairs: [],
  flaky: [],
};

let sequence = 0;

function event<T extends RunEventType>(type: T, data: RunEventPayloads[T]): RunEvent {
  sequence += 1;
  return {
    id: String(sequence),
    runId: "run-1",
    ts: new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)).toISOString(),
    type,
    data,
  } as RunEvent;
}

describe("buildLiveModel", () => {
  it("lists planned tests as pending before any event arrives", () => {
    const model = buildLiveModel(detail, []);

    expect(model.tests.map((test) => test.testId)).toEqual(["TC-01", "TC-02"]);
    expect(model.tests.every((test) => test.status === "pending")).toBe(true);
    expect(liveProgress(model)).toEqual({ done: 0, total: 2 });
  });

  it("seeds steps and results from a partially persisted run", () => {
    const model = buildLiveModel(
      {
        ...detail,
        tests: [
          {
            testId: "TC-01",
            title: "Successful login",
            criterion: "c",
            status: "passed",
            durationMs: 1200,
            repairs: [],
            history: ["passed"],
          },
        ],
        steps: [
          {
            testId: "TC-01",
            stepIndex: 0,
            description: "Navigate",
            status: "passed",
            durationMs: 400,
          },
        ],
      },
      [],
    );

    const first = model.tests[0];
    expect(first.status).toBe("passed");
    expect(first.durationMs).toBe(1200);
    expect(first.steps.map((step) => step.description)).toEqual(["Navigate"]);
  });

  it("tracks a healed step and keeps it healed when step.passed follows", () => {
    const model = buildLiveModel(detail, [
      event("test.started", { testId: "TC-02", title: "Add a todo" }),
      event("step.started", { testId: "TC-02", stepIndex: 1, description: "Type a task" }),
      event("step.healing", {
        testId: "TC-02",
        stepIndex: 1,
        reason: "no match",
        oldLocator: "#todo-input",
      }),
      event("step.healed", {
        testId: "TC-02",
        stepIndex: 1,
        oldLocator: "#todo-input",
        newLocator: "#task-entry-field",
        modelUsed: "groq/openai/gpt-oss-120b",
        confidence: 0.94,
      }),
      event("step.passed", { testId: "TC-02", stepIndex: 1, durationMs: 900, cached: false }),
    ]);

    const test = model.tests.find((entry) => entry.testId === "TC-02");
    const step = test?.steps.find((entry) => entry.stepIndex === 1);

    expect(step?.status).toBe("healed");
    expect(step?.newLocator).toBe("#task-entry-field");
    expect(model.heals).toHaveLength(1);
    expect(model.heals[0]).toMatchObject({ testId: "TC-02", stepIndex: 1, confidence: 0.94 });
  });

  it("streams reasoning per test and step", () => {
    const model = buildLiveModel(detail, [
      event("step.reasoning", { testId: "TC-01", stepIndex: 0, text: "Looking for the form" }),
      event("step.reasoning", { testId: "TC-01", stepIndex: 0, text: "Found #username" }),
    ]);

    expect(model.reasoning["TC-01"][0]).toEqual(["Looking for the form", "Found #username"]);
  });

  it("clears the active step when it finishes and records failures", () => {
    const model = buildLiveModel(detail, [
      event("step.started", { testId: "TC-01", stepIndex: 0, description: "Navigate" }),
      event("step.failed", {
        testId: "TC-01",
        stepIndex: 0,
        error: "locator resolved to 0 elements",
      }),
    ]);

    expect(model.active).toBeUndefined();
    const step = model.tests[0].steps[0];
    expect(step.status).toBe("failed");
    expect(step.error).toBe("locator resolved to 0 elements");
  });

  it("exposes the active step while it is running", () => {
    const model = buildLiveModel(detail, [
      event("step.started", { testId: "TC-01", stepIndex: 1, description: "Fill the form" }),
    ]);

    expect(model.active).toEqual({ testId: "TC-01", stepIndex: 1, description: "Fill the form" });
  });

  it("folds finished tests and the final summary", () => {
    const finished: RunSummary = {
      ...summary,
      status: "passed",
      total: 2,
      passed: 2,
      finishedAt: "2026-01-01T00:01:00.000Z",
    };
    const model = buildLiveModel(detail, [
      event("test.finished", { testId: "TC-01", status: "healed", durationMs: 2000 }),
      event("test.finished", { testId: "TC-02", status: "passed", durationMs: 1500 }),
      event("run.finished", { summary: finished }),
    ]);

    expect(model.tests.map((test) => test.status)).toEqual(["healed", "passed"]);
    expect(model.summary?.status).toBe("passed");
    expect(model.lastEventAt).toBeDefined();
    expect(liveProgress(model)).toEqual({ done: 2, total: 2 });
  });

  it("records a run-level error", () => {
    const model = buildLiveModel(detail, [event("run.error", { message: "Browser crashed" })]);

    expect(model.error).toBe("Browser crashed");
  });

  it("is deterministic for the same event replay", () => {
    const events = [
      event("test.started", { testId: "TC-01", title: "Successful login" }),
      event("step.started", { testId: "TC-01", stepIndex: 0, description: "Navigate" }),
      event("step.passed", { testId: "TC-01", stepIndex: 0, durationMs: 300, cached: true }),
    ];

    expect(buildLiveModel(detail, events)).toEqual(buildLiveModel(detail, events));
  });
});
