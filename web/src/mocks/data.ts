import type {
  FlakyInfo,
  RepairView,
  RunDetail,
  RunStep,
  RunSummary,
  Settings,
  Stats,
  TestCase,
  TestResult,
  Ticket,
} from "../../../shared/contracts";

/**
 * Fixtures for offline UI work (MSW). Shapes are typed against the contracts,
 * so a schema change breaks the mock build instead of the browser.
 */

export const mockTicket: Ticket = {
  key: "QA-101",
  title: "User can log in and manage todos",
  description:
    "As a registered user I want to sign in, add tasks and sign out so that I can organise my day.",
  acceptanceCriteria: [
    "Logging in with valid credentials shows the todo list",
    "Adding a todo appends it to the list",
    "Invalid credentials show an error message",
    "Logging out returns the user to the login screen",
  ],
};

/** Bundled demo pages served by the API, one UI per SQA ticket. */
export const mockDemoPages: string[] = [
  "Croupt.html",
  "index.html",
  "calculator.html",
  "contact-form.html",
  "notes.html",
  "currency.html",
  "theme-toggle.html",
  "search-filter.html",
  "counter.html",
  "bmi.html",
  "password-strength.html",
  "shopping-list.html",
];

export const mockTestCases: TestCase[] = [
  {
    id: "TC-01",
    title: "Successful login",
    criterion: "Logging in with valid credentials shows the todo list",
    expectedOutcome: "The todo list is visible",
    steps: [
      { description: "Navigate to the demo app" },
      { description: "Type the username into #username", data: { value: "demo" } },
      { description: "Type the password into #password", data: { value: "secret" } },
      { description: "Click #login-btn" },
      { description: "Assert the todo list is visible" },
    ],
  },
  {
    id: "TC-02",
    title: "Add a todo item",
    criterion: "Adding a todo appends it to the list",
    expectedOutcome: "The new todo appears in the list",
    steps: [
      { description: "Navigate to the demo app" },
      { description: "Fill the login form" },
      { description: "Type a task into #todo-input", data: { value: "Ship the release" } },
      { description: "Click #add-todo-btn" },
      { description: "Assert the item is listed" },
    ],
  },
  {
    id: "TC-03",
    title: "Invalid credentials show an error",
    criterion: "Invalid credentials show an error message",
    expectedOutcome: "An error message is displayed",
    steps: [
      { description: "Navigate to the demo app" },
      { description: "Enter a wrong password" },
      { description: "Submit the form" },
    ],
  },
  {
    id: "TC-04",
    title: "Logout returns to login",
    criterion: "Logging out returns the user to the login screen",
    expectedOutcome: "The login form is visible again",
    steps: [
      { description: "Navigate to the demo app" },
      { description: "Log in with valid credentials" },
      { description: "Click #logout-btn" },
      { description: "Assert the login form is visible" },
    ],
  },
];

const repair = (overrides: Partial<RepairView>): RepairView => ({
  timestamp: new Date(Date.now() - 90_000).toISOString(),
  testId: "TC-02",
  stepIndex: 2,
  stepDescription: "Type a task into #todo-input",
  oldLocator: "#todo-input",
  newLocator: "#task-entry-field",
  reason:
    "No element matched #todo-input; the nearest candidate exposes a task-entry field with matching role.",
  modelUsed: "groq/openai/gpt-oss-120b",
  confidence: 0.94,
  repairId: "run-mock-0001:TC-02:2",
  runId: "run-mock-0001",
  runTicketKey: "QA-101",
  review: null,
  ...overrides,
});

export const mockRepairs: RepairView[] = [
  repair({}),
  repair({
    repairId: "run-mock-0001:TC-04:2",
    testId: "TC-04",
    stepIndex: 2,
    stepDescription: "Click #logout-btn",
    oldLocator: "#logout-btn",
    newLocator: "#btn-terminate-session",
    confidence: 0.71,
  }),
  repair({
    repairId: "run-mock-0002:TC-02:3",
    runId: "run-mock-0002",
    confidence: 0.62,
    review: {
      repairId: "run-mock-0002:TC-02:3",
      decision: "approved",
      reviewedAt: new Date(Date.now() - 3_600_000).toISOString(),
    },
  }),
];

const summarize = (overrides: Partial<RunSummary> & { runId: string }): RunSummary => ({
  ticketKey: "QA-101",
  ticketTitle: mockTicket.title,
  baseUrl: "file:///demo/index.html",
  appVersion: "v1",
  status: "passed",
  createdAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: 42_000,
  repeat: 2,
  total: 4,
  passed: 3,
  failed: 0,
  healed: 1,
  flaky: 0,
  repairsCount: 1,
  mock: true,
  ...overrides,
});

export const mockSummaries: RunSummary[] = [
  summarize({
    runId: "run-mock-0001",
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  }),
  summarize({
    runId: "run-mock-0002",
    status: "failed",
    passed: 2,
    failed: 1,
    healed: 1,
    repairsCount: 2,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  }),
  summarize({
    runId: "run-mock-0003",
    status: "running",
    finishedAt: null,
    durationMs: 0,
    createdAt: new Date(Date.now() - 30_000).toISOString(),
    startedAt: new Date(Date.now() - 30_000).toISOString(),
  }),
];

const stepsFor = (testId: string, descriptions: string[]): RunStep[] =>
  descriptions.map((description, stepIndex) => ({
    testId,
    stepIndex,
    description,
    status: "passed",
    durationMs: 320 + stepIndex * 40,
  }));

const testResult = (
  overrides: Partial<TestResult> & { testId: string; title: string },
): TestResult => ({
  criterion: "Acceptance criterion",
  status: "passed",
  durationMs: 8_400,
  repairs: [],
  history: ["passed", "passed"],
  ...overrides,
});

export function buildMockDetail(runId: string): RunDetail {
  const summary = mockSummaries.find((run) => run.runId === runId) ?? mockSummaries[0];
  const healedTest = testResult({
    testId: "TC-02",
    title: "Add a todo item",
    criterion: mockTicket.acceptanceCriteria[1],
    status: "healed",
    repairs: [{ ...mockRepairs[0] }],
    screenshotPath: "/api/runs/run-mock-0001/artifacts/screenshots/TC-02.png",
  });

  const tests: TestResult[] = [
    testResult({
      testId: "TC-01",
      title: "Successful login",
      criterion: mockTicket.acceptanceCriteria[0],
    }),
    healedTest,
    testResult({
      testId: "TC-03",
      title: "Invalid credentials show an error",
      criterion: mockTicket.acceptanceCriteria[2],
      status: summary.failed > 0 ? "failed" : "passed",
      error:
        summary.failed > 0
          ? "Expected error banner to be visible, but the login succeeded."
          : undefined,
    }),
    testResult({
      testId: "TC-04",
      title: "Logout returns to login",
      criterion: mockTicket.acceptanceCriteria[3],
    }),
  ];

  const steps = [
    ...stepsFor(
      "TC-01",
      mockTestCases[0].steps.map((step) => step.description),
    ),
    ...stepsFor(
      "TC-02",
      mockTestCases[1].steps.map((step) => step.description),
    ).map((step) =>
      step.stepIndex === 2
        ? {
            ...step,
            status: "healed" as const,
            oldLocator: "#todo-input",
            newLocator: "#task-entry-field",
          }
        : step,
    ),
    ...stepsFor(
      "TC-03",
      mockTestCases[2].steps.map((step) => step.description),
    ),
    ...stepsFor(
      "TC-04",
      mockTestCases[3].steps.map((step) => step.description),
    ),
  ];

  const flaky: FlakyInfo[] = [
    { testId: "TC-01", title: "Successful login", history: ["passed", "passed"], score: 0 },
    { testId: "TC-02", title: "Add a todo item", history: ["healed", "passed"], score: 0.35 },
    {
      testId: "TC-03",
      title: "Invalid credentials show an error",
      history: ["failed", "passed"],
      score: 0.6,
    },
    {
      testId: "TC-04",
      title: "Logout returns to login",
      history: ["passed", "healed"],
      score: 0.35,
    },
  ];

  return {
    summary,
    ticket: mockTicket,
    plannedTests: mockTestCases,
    tests,
    steps,
    repairs: mockRepairs.filter((entry) => entry.runId === summary.runId),
    flaky,
  };
}

export const mockStats: Stats = {
  totals: { runs: 24, tests: 96, passed: 78, failed: 9, healed: 12, flaky: 3, repairs: 21 },
  passRateTrend: mockSummaries.map((summary, index) => ({
    runId: summary.runId,
    label: `mock-${index + 1}`,
    passRate: Math.round(((summary.passed + summary.healed) / Math.max(summary.total, 1)) * 100),
    createdAt: summary.createdAt,
  })),
  llmCalls: 117,
  cacheHits: 26,
  repairsAutoApproved: 14,
  estimatedMinutesSaved: 129.3,
};

export const mockSettings: Settings = {
  models: { groq: "openai/gpt-oss-120b", gemini: "gemini-2.5-flash" },
  repeatDefault: 2,
  targets: ["http://localhost:3000", "https://www.saucedemo.com"],
  theme: "dark",
  demoAppVersion: "v1",
};
