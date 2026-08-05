import * as fs from "fs";
import * as path from "path";
import type {
  AppVersion,
  ReviewRecord,
  RunStatus,
  RunStep,
  StepStatus,
  TestCase,
  TestResult,
  TestResultStatus,
  Ticket,
} from "../../../shared/contracts";
import { generateHeuristicTestCases } from "../../../src/generator/criteriaToSteps";
import { env } from "../env";
import { emptySummary, reconcileSummary, type StoredRun } from "../store";

/** Loads `fixtures/mock-ticket.json` without touching the Jira client. */
export function mockTicket(): Ticket {
  const file = path.join(env.fixturesDir, "mock-ticket.json");
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Ticket;
}

/**
 * Deterministic stand-in screenshot so the visual-diff tab is demoable with no
 * browser and no network. Encoded as an inline SVG data URI.
 */
export function mockScreenshot(kind: "before" | "after"): string {
  const accent = kind === "before" ? "#f59e0b" : "#10b981";
  const idLabel =
    kind === "before" ? "#username / #password" : "#user-account-input / #user-secret-key";
  const buttonLabel = kind === "before" ? "Login" : "Log In";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="404" viewBox="0 0 720 404">
  <rect width="720" height="404" fill="#0b1220"/>
  <rect x="196" y="46" width="328" height="312" rx="14" fill="#111a2e" stroke="#22304d"/>
  <text x="360" y="92" font-family="Segoe UI,Arial" font-size="22" font-weight="600" fill="#e2e8f5" text-anchor="middle">Sign In</text>
  <text x="360" y="118" font-family="Consolas,monospace" font-size="11" fill="${accent}" text-anchor="middle">${idLabel}</text>
  <rect x="228" y="140" width="264" height="40" rx="8" fill="#0b1220" stroke="#33415c"/>
  <text x="242" y="165" font-family="Segoe UI,Arial" font-size="13" fill="#7c8aa5">Username</text>
  <rect x="228" y="196" width="264" height="40" rx="8" fill="#0b1220" stroke="#33415c"/>
  <text x="242" y="221" font-family="Segoe UI,Arial" font-size="13" fill="#7c8aa5">Password</text>
  <rect x="228" y="256" width="264" height="42" rx="8" fill="${accent}" opacity="0.85"/>
  <text x="360" y="282" font-family="Segoe UI,Arial" font-size="14" font-weight="600" fill="#07101f" text-anchor="middle">${buttonLabel}</text>
  <text x="360" y="330" font-family="Consolas,monospace" font-size="11" fill="#64748b" text-anchor="middle">Agentic-mesh demo app — ${kind}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

interface MockRunSpec {
  runId: string;
  createdAt: string;
  appVersion: AppVersion;
  /** Derived from `perTest` when omitted. */
  status?: RunStatus;
  repeat: number;
  baseUrl: string;
  perTest: TestResultStatus[];
  histories?: string[][];
  reviews?: ReviewRecord[];
  ticket?: Ticket;
  /** Overrides the heuristic test cases (e.g. user-edited steps from the New Run flow). */
  testCases?: TestCase[];
}

function stepStatusFor(
  testStatus: TestResultStatus,
  stepIndex: number,
  stepCount: number,
): StepStatus {
  if (testStatus === "passed") return "passed";
  if (testStatus === "healed") return stepIndex === 1 ? "healed" : "passed";
  if (testStatus === "flaky") return stepIndex === 1 ? "healed" : "passed";
  // failed: the last step is the one that broke.
  return stepIndex === stepCount - 1 ? "failed" : "passed";
}

/** Builds a complete, self-consistent run record used by mock mode and the demo seed. */
export function buildMockRun(spec: MockRunSpec): StoredRun {
  const ticket = spec.ticket ?? mockTicket();
  const runStatus: RunStatus =
    spec.status ?? (spec.perTest.some((s) => s === "failed") ? "failed" : "passed");
  const testCases = spec.testCases ?? generateHeuristicTestCases(ticket);
  const tests: TestResult[] = [];
  const steps: RunStep[] = [];

  testCases.forEach((testCase, index) => {
    const status = spec.perTest[index] ?? "passed";
    const durationMs = 1800 + index * 420;
    const repairs =
      status === "healed" || status === "flaky"
        ? [
            {
              timestamp: spec.createdAt,
              testId: testCase.id,
              stepIndex: 1,
              stepDescription: testCase.steps[1]?.description ?? "Fill username",
              oldLocator: "#username",
              newLocator: "#user-account-input",
              reason:
                "Element #username no longer exists after the v2 refactor; matched by placeholder, label and position.",
              modelUsed: "groq/openai/gpt-oss-120b",
              confidence: status === "flaky" ? 0.71 : 0.94,
              beforeScreenshot: mockScreenshot("before"),
              afterScreenshot: mockScreenshot("after"),
            },
          ]
        : [];

    const history =
      spec.histories?.[index] ??
      (status === "flaky"
        ? ["passed", "failed", "healed", "passed", "failed"].slice(0, spec.repeat)
        : Array.from({ length: Math.max(1, spec.repeat) }, () => status));

    tests.push({
      testId: testCase.id,
      title: testCase.title,
      criterion: testCase.criterion,
      status,
      durationMs,
      repairs,
      error:
        status === "failed"
          ? `waitForFunction: expected "Welcome, admin!" but the page still shows "Sign In" after 5000ms`
          : undefined,
      stepsExecuted: testCase.steps.length,
      history,
      screenshotPath: status === "failed" ? mockScreenshot("before") : undefined,
    });

    testCase.steps.forEach((step, stepIndex) => {
      steps.push({
        testId: testCase.id,
        stepIndex,
        description: step.description,
        status: stepStatusFor(status, stepIndex, testCase.steps.length),
        durationMs: 180 + stepIndex * 90,
        cached: stepIndex === 0 && index === 0,
        oldLocator: stepIndex === 1 && repairs.length > 0 ? "#username" : undefined,
        newLocator: stepIndex === 1 && repairs.length > 0 ? "#user-account-input" : undefined,
        error:
          status === "failed" && stepIndex === testCase.steps.length - 1
            ? 'locator("#todo-input") resolved to 0 elements'
            : undefined,
      });
    });
  });

  const summary = reconcileSummary({
    summary: {
      ...emptySummary({
        runId: spec.runId,
        baseUrl: spec.baseUrl,
        appVersion: spec.appVersion,
        repeat: spec.repeat,
        ticketKey: ticket.key,
        ticketTitle: ticket.title,
        mock: true,
      }),
      status: runStatus,
      createdAt: spec.createdAt,
      startedAt: spec.createdAt,
      finishedAt: new Date(new Date(spec.createdAt).getTime() + 42_000).toISOString(),
      durationMs: 42_000,
    },
    ticket,
    testCases,
    tests,
    steps,
    reviews: spec.reviews ?? [],
    config: {
      baseUrl: spec.baseUrl,
      repeat: spec.repeat,
      appVersion: spec.appVersion,
      headless: true,
    },
  });

  return {
    summary,
    ticket,
    testCases,
    tests,
    steps,
    reviews: spec.reviews ?? [],
    config: {
      baseUrl: spec.baseUrl,
      repeat: spec.repeat,
      appVersion: spec.appVersion,
      headless: true,
    },
  };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Three historical runs so the dashboard and history page are never empty. */
export function seedRuns(): StoredRun[] {
  return [
    buildMockRun({
      runId: "run-seed-0001",
      createdAt: daysAgo(6),
      appVersion: "v1",
      repeat: 1,
      baseUrl: "file:///demo/index.html",
      perTest: ["passed", "passed", "passed", "passed"],
    }),
    buildMockRun({
      runId: "run-seed-0002",
      createdAt: daysAgo(3),
      appVersion: "v2",
      repeat: 1,
      baseUrl: "file:///demo/index.html",
      perTest: ["passed", "failed", "passed", "passed"],
    }),
    buildMockRun({
      runId: "run-seed-0003",
      createdAt: daysAgo(2),
      appVersion: "v2",
      repeat: 3,
      baseUrl: "file:///demo/index.html",
      perTest: ["passed", "healed", "flaky", "passed"],
      reviews: [
        {
          repairId: "run-seed-0003:TC-02:1",
          decision: "approved",
          note: "Matches the new account label.",
          reviewedAt: daysAgo(2),
        },
      ],
    }),
    buildMockRun({
      runId: "run-seed-0004",
      createdAt: daysAgo(1),
      appVersion: "v2",
      repeat: 1,
      baseUrl: "file:///demo/index.html",
      perTest: ["passed", "healed", "healed", "failed"],
    }),
  ];
}
