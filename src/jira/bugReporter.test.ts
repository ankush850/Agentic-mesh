/**
 * bugReporter.test.ts
 * -------------------
 * Unit tests for src/jira/bugReporter.ts
 * All external I/O (Groq, fetch, fs) is mocked — no real network calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports of the module under test)
// ---------------------------------------------------------------------------

// Mock groq-sdk
vi.mock("groq-sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content:
                  "1. Login button is missing after UI update\n" +
                  "2. Steps to Reproduce:\n1. Navigate to /login\n2. Observe the page\n" +
                  "3. Expected: Login button visible. Actual: Button absent.",
              },
            },
          ],
        }),
      },
    },
  })),
}));

// Mock fs
vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue(Buffer.from("fake-png-bytes")),
}));

// Mock the logger to suppress output during tests
vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Set up a global fetch mock before importing the module
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
(global as any).fetch = mockFetch;

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are registered
// ---------------------------------------------------------------------------
import {
  isBugReporterConfigured,
  generateBugDescription,
  createJiraBugTicket,
  attachScreenshotToJiraIssue,
  reportBugToJira,
} from "./bugReporter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_TEST_RESULT = {
  testId: "TC-01",
  title: "User Login Test",
  criterion: "Given the login page, when I click login, then I see a welcome message",
  status: "failed" as const,
  durationMs: 3500,
  repairs: [],
  error: "Locator #login-btn not found",
  stepsExecuted: 1,
  screenshotPath: "reports/screenshots/failure-TC-01-123.png",
  history: ["failed"],
};

const MOCK_TEST_CASE = {
  id: "TC-01",
  title: "User Login Test",
  criterion: "Given the login page, when I click login, then I see a welcome message",
  steps: [
    { description: "Navigate to login page", action: "navigate", target: "/" },
    { description: "Click login button", action: "click", target: "#login-btn" },
  ],
  expectedOutcome: "Welcome message visible",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("isBugReporterConfigured()", () => {
  afterEach(() => {
    delete process.env.JIRA_BASE_URL;
    delete process.env.JIRA_EMAIL;
    delete process.env.JIRA_API_TOKEN;
    delete process.env.JIRA_PROJECT_KEY;
  });

  it("returns true when all 4 env vars are set", () => {
    process.env.JIRA_BASE_URL = "https://example.atlassian.net";
    process.env.JIRA_EMAIL = "qa@example.com";
    process.env.JIRA_API_TOKEN = "tok_abc";
    process.env.JIRA_PROJECT_KEY = "SQA";
    expect(isBugReporterConfigured()).toBe(true);
  });

  it("returns false when JIRA_PROJECT_KEY is missing", () => {
    process.env.JIRA_BASE_URL = "https://example.atlassian.net";
    process.env.JIRA_EMAIL = "qa@example.com";
    process.env.JIRA_API_TOKEN = "tok_abc";
    expect(isBugReporterConfigured()).toBe(false);
  });

  it("returns false when JIRA_EMAIL is missing", () => {
    process.env.JIRA_BASE_URL = "https://example.atlassian.net";
    process.env.JIRA_API_TOKEN = "tok_abc";
    process.env.JIRA_PROJECT_KEY = "SQA";
    expect(isBugReporterConfigured()).toBe(false);
  });

  it("returns false when no env vars are set", () => {
    expect(isBugReporterConfigured()).toBe(false);
  });
});

describe("generateBugDescription()", () => {
  afterEach(() => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_MODEL;
    vi.clearAllMocks();
  });

  it("returns fallback when GROQ_API_KEY is not set", async () => {
    delete process.env.GROQ_API_KEY;
    const { summary, fullReport } = await generateBugDescription(
      MOCK_TEST_RESULT,
      MOCK_TEST_CASE
    );
    expect(summary).toContain("User Login Test");
    expect(fullReport).toContain("Steps to Reproduce");
  });

  it("extracts summary from Groq response correctly", async () => {
    process.env.GROQ_API_KEY = "gsk_test";
    process.env.GROQ_MODEL = "openai/gpt-oss-120b";
    const { summary } = await generateBugDescription(MOCK_TEST_RESULT, MOCK_TEST_CASE);
    // The mock returns a line starting with "1. Login button..."
    expect(summary).toContain("Login button");
    expect(summary.length).toBeLessThanOrEqual(100);
  });

  it("falls back to template when Groq throws", async () => {
    process.env.GROQ_API_KEY = "gsk_test";
    // Override the mock to throw
    const Groq = (await import("groq-sdk")).default as any;
    const mockInstance = new Groq();
    mockInstance.chat.completions.create.mockRejectedValueOnce(new Error("Network error"));
    const { summary } = await generateBugDescription(MOCK_TEST_RESULT, MOCK_TEST_CASE);
    expect(summary).toContain("User Login Test");
  });
});

describe("createJiraBugTicket()", () => {
  beforeEach(() => {
    process.env.JIRA_BASE_URL = "https://example.atlassian.net";
    process.env.JIRA_EMAIL = "qa@example.com";
    process.env.JIRA_API_TOKEN = "tok_abc";
  });

  afterEach(() => {
    delete process.env.JIRA_BASE_URL;
    delete process.env.JIRA_EMAIL;
    delete process.env.JIRA_API_TOKEN;
    mockFetch.mockReset();
  });

  it("returns issue key on successful 201 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ key: "SQA-42" }),
    });
    const result = await createJiraBugTicket(
      "Login button missing",
      { type: "doc", version: 1, content: [] },
      "SQA"
    );
    expect(result).toBe("SQA-42");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.atlassian.net/rest/api/3/issue",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns null when fetch responds with 400", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
    });
    const result = await createJiraBugTicket("Login button missing", {}, "SQA");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws (network error)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await createJiraBugTicket("Login button missing", {}, "SQA");
    expect(result).toBeNull();
  });
});

describe("attachScreenshotToJiraIssue()", () => {
  beforeEach(() => {
    process.env.JIRA_BASE_URL = "https://example.atlassian.net";
    process.env.JIRA_EMAIL = "qa@example.com";
    process.env.JIRA_API_TOKEN = "tok_abc";
  });

  afterEach(() => {
    delete process.env.JIRA_BASE_URL;
    delete process.env.JIRA_EMAIL;
    delete process.env.JIRA_API_TOKEN;
    mockFetch.mockReset();
    vi.clearAllMocks();
  });

  it("returns false when the screenshot file does not exist", async () => {
    const fs = await import("fs");
    (fs.existsSync as any).mockReturnValueOnce(false);
    const result = await attachScreenshotToJiraIssue("SQA-42", "/nonexistent/path.png");
    expect(result).toBe(false);
  });

  it("returns true when file exists and fetch responds OK", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const result = await attachScreenshotToJiraIssue(
      "SQA-42",
      "reports/screenshots/failure-TC-01-123.png"
    );
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.atlassian.net/rest/api/3/issue/SQA-42/attachments",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Atlassian-Token": "no-check" }),
      })
    );
  });

  it("returns false when fetch responds with 403", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });
    const result = await attachScreenshotToJiraIssue("SQA-42", "path/to/shot.png");
    expect(result).toBe(false);
  });
});

describe("reportBugToJira()", () => {
  afterEach(() => {
    delete process.env.JIRA_BASE_URL;
    delete process.env.JIRA_EMAIL;
    delete process.env.JIRA_API_TOKEN;
    delete process.env.JIRA_PROJECT_KEY;
    delete process.env.GROQ_API_KEY;
    mockFetch.mockReset();
    vi.clearAllMocks();
  });

  it("returns null immediately when not configured", async () => {
    // No env vars set → not configured
    const result = await reportBugToJira({
      result: MOCK_TEST_RESULT,
      testCase: MOCK_TEST_CASE,
      parentTicketKey: "QA-101",
    });
    expect(result).toBeNull();
  });

  it("returns BugTicketCreated on full success path", async () => {
    process.env.JIRA_BASE_URL = "https://example.atlassian.net";
    process.env.JIRA_EMAIL = "qa@example.com";
    process.env.JIRA_API_TOKEN = "tok_abc";
    process.env.JIRA_PROJECT_KEY = "SQA";
    // No Groq key → will use fallback description template

    // Mock issue creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ key: "SQA-99" }),
    });
    // Mock screenshot attachment
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await reportBugToJira({
      result: MOCK_TEST_RESULT,
      testCase: MOCK_TEST_CASE,
      parentTicketKey: "QA-101",
    });

    expect(result).not.toBeNull();
    expect(result!.issueKey).toBe("SQA-99");
    expect(result!.issueUrl).toBe("https://example.atlassian.net/browse/SQA-99");
    expect(typeof result!.summary).toBe("string");
  });

  it("returns null when Jira issue creation fails", async () => {
    process.env.JIRA_BASE_URL = "https://example.atlassian.net";
    process.env.JIRA_EMAIL = "qa@example.com";
    process.env.JIRA_API_TOKEN = "tok_abc";
    process.env.JIRA_PROJECT_KEY = "SQA";

    // Mock issue creation failure
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Project not found",
    });

    const result = await reportBugToJira({
      result: MOCK_TEST_RESULT,
      testCase: MOCK_TEST_CASE,
      parentTicketKey: "QA-101",
    });

    expect(result).toBeNull();
  });
});

