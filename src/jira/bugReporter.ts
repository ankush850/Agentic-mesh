/**
 * bugReporter.ts
 * --------------
 * Autonomous Bug Ticket Creator for Agentic-mesh.
 *
 * When a test fails AND self-healing cannot recover it, this module:
 *   1. Calls Groq to generate a professional bug description.
 *   2. Creates a Jira Bug issue via REST API v3.
 *   3. Attaches the failure screenshot to the issue.
 *   4. Returns the created issue key (e.g. "SQA-42") or null on any error.
 *
 * Caller: src/runner/agenticMeshRunner.ts (in runTestCases, after final status is resolved)
 * Guarded by: options.autoBug === true && env vars present
 */

import * as fs from "fs";
import * as path from "path";
import Groq from "groq-sdk";
import { logger } from "../logger";
import type { TestResult, TestCase } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BugTicketOptions {
  /** The TestResult object from runSingleAttempt. Must have status === "failed". */
  result: TestResult;
  /** The full TestCase object for step count and criterion reference. */
  testCase: TestCase;
  /** The parent Jira ticket key (e.g. "QA-101") for reference in description. */
  parentTicketKey: string;
}

export interface BugTicketCreated {
  /** The newly created Jira issue key, e.g. "SQA-42". */
  issueKey: string;
  /** Direct browser URL to the issue. */
  issueUrl: string;
  /** The AI-generated one-line summary used as the Jira issue title. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validates that all required Jira environment variables are set.
 * Returns true if the Jira bug reporter can operate.
 */
export function isBugReporterConfigured(): boolean {
  return Boolean(
    process.env.JIRA_BASE_URL &&
      process.env.JIRA_EMAIL &&
      process.env.JIRA_API_TOKEN &&
      process.env.JIRA_PROJECT_KEY
  );
}

/**
 * Builds the Basic Auth header value for Jira REST API v3.
 * Format: "Basic base64(email:apiToken)"
 */
function jiraAuthHeader(): string {
  const creds = `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`;
  return "Basic " + Buffer.from(creds).toString("base64");
}

/**
 * Calls Groq to generate a 3-section bug report for the failed test.
 * Returns plain text with sections: Summary, Steps to Reproduce, Expected vs Actual.
 * Falls back to a deterministic template if Groq is unavailable or errors.
 */
export async function generateBugDescription(
  result: TestResult,
  testCase: TestCase
): Promise<{ summary: string; fullReport: string }> {
  const FALLBACK_SUMMARY = `Test failed: ${result.title.slice(0, 80)}`;
  const FALLBACK_REPORT =
    `Summary: ${FALLBACK_SUMMARY}\n\n` +
    `Steps to Reproduce:\n1. Navigate to the app.\n2. Run acceptance criterion: "${result.criterion}"\n\n` +
    `Expected: Test passes according to acceptance criteria.\n` +
    `Actual: Test failed with error: ${result.error ?? "Unknown error"}`;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    logger.warn("GROQ_API_KEY not set — using fallback bug description template.");
    return { summary: FALLBACK_SUMMARY, fullReport: FALLBACK_REPORT };
  }

  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const client = new Groq({ apiKey, maxRetries: 0, timeout: 4000 });

  const userPrompt =
    `A UI test failed for the following acceptance criterion:\n` +
    `"${result.criterion}"\n\n` +
    `Test title: "${result.title}"\n` +
    `Error message: "${result.error ?? "No error message captured"}"\n` +
    `Steps executed before failure: ${result.stepsExecuted ?? 0} of ${testCase.steps.length}\n\n` +
    `Write a 3-section bug report:\n` +
    `1. Summary (one sentence, max 100 characters, plain text)\n` +
    `2. Steps to Reproduce (numbered list)\n` +
    `3. Expected vs Actual Behaviour`;

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a professional QA engineer writing a Jira bug report. " +
            "Be concise, technical, and use BDD language. " +
            "Return plain text only — no markdown, no JSON, no code fences.",
        },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) {
      logger.warn({ testId: result.testId }, "Groq returned empty content for bug description.");
      return { summary: FALLBACK_SUMMARY, fullReport: FALLBACK_REPORT };
    }

    // Extract the Summary line (first non-empty line after "1." or "Summary:")
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    let summaryLine = "";
    for (const line of lines) {
      const stripped = line.replace(/^(1\.|Summary:?)\s*/i, "").trim();
      if (stripped.length > 5) {
        summaryLine = stripped.slice(0, 100);
        break;
      }
    }
    if (!summaryLine) summaryLine = FALLBACK_SUMMARY;

    logger.info({ testId: result.testId, model }, "Bug description generated via Groq.");
    return { summary: summaryLine, fullReport: raw };
  } catch (err) {
    logger.error(
      { err, testId: result.testId },
      "Groq call failed for bug description — using fallback."
    );
    return { summary: FALLBACK_SUMMARY, fullReport: FALLBACK_REPORT };
  }
}

/**
 * Creates an Atlassian Document Format (ADF) paragraph node from plain text.
 * Used to build the Jira issue description field.
 */
function adfParagraph(text: string): object {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

/**
 * Builds the full ADF document for the Jira Bug description field.
 */
function buildAdfDescription(
  fullReport: string,
  parentTicketKey: string,
  screenshotPath: string | undefined
): object {
  const content: object[] = [
    adfParagraph("🤖 This bug was automatically detected and reported by Agentic-mesh."),
    adfParagraph(`Parent Ticket: ${parentTicketKey}`),
    { type: "rule" },
    adfParagraph(fullReport),
  ];

  if (screenshotPath) {
    content.push({ type: "rule" });
    content.push(
      adfParagraph(
        `Screenshot is attached to this issue. Filename: ${path.basename(screenshotPath)}`
      )
    );
  }

  return {
    type: "doc",
    version: 1,
    content,
  };
}

/**
 * Creates a Jira Bug issue via Jira REST API v3.
 * Returns the created issue key (e.g. "SQA-42") or null on failure.
 *
 * API Reference: POST /rest/api/3/issue
 * Docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/
 */
export async function createJiraBugTicket(
  summary: string,
  adfDescription: object,
  projectKey: string
): Promise<string | null> {
  const baseUrl = (process.env.JIRA_BASE_URL ?? "").replace(/\/$/, "");
  const endpoint = `${baseUrl}/rest/api/3/issue`;

  const body = {
    fields: {
      project: { key: projectKey },
      issuetype: { name: "Bug" },
      summary: `[Agentic-mesh] ${summary}`,
      description: adfDescription,
      priority: { name: "High" },
      labels: ["agentic-mesh", "auto-generated"],
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: jiraAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error(
        { status: response.status, body: errText },
        "Jira issue creation failed."
      );
      return null;
    }

    const json = (await response.json()) as { key?: string };
    const issueKey = json.key ?? null;
    if (issueKey) {
      logger.info({ issueKey }, "Jira Bug ticket created successfully.");
    }
    return issueKey;
  } catch (err) {
    logger.error({ err }, "Network error creating Jira Bug ticket.");
    return null;
  }
}

/**
 * Attaches a PNG screenshot to an existing Jira issue.
 * Uses the Jira Attachment REST API v3 with FormData (Node 18+ native).
 *
 * API Reference: POST /rest/api/3/issue/{issueIdOrKey}/attachments
 * Required header: X-Atlassian-Token: no-check  (CSRF bypass for attachment endpoint)
 */
export async function attachScreenshotToJiraIssue(
  issueKey: string,
  screenshotPath: string
): Promise<boolean> {
  const baseUrl = (process.env.JIRA_BASE_URL ?? "").replace(/\/$/, "");
  const endpoint = `${baseUrl}/rest/api/3/issue/${issueKey}/attachments`;

  if (!fs.existsSync(screenshotPath)) {
    logger.warn({ screenshotPath, issueKey }, "Screenshot file not found — skipping attachment.");
    return false;
  }

  try {
    const fileBuffer = fs.readFileSync(screenshotPath);
    const fileName = path.basename(screenshotPath);

    // Node 18+ native FormData + Blob
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: "image/png" });
    formData.append("file", blob, fileName);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: jiraAuthHeader(),
        "X-Atlassian-Token": "no-check",
        // Do NOT set Content-Type — fetch sets it automatically with boundary for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error(
        { issueKey, status: response.status, body: errText },
        "Failed to attach screenshot to Jira issue."
      );
      return false;
    }

    logger.info({ issueKey, fileName }, "Screenshot attached to Jira issue successfully.");
    return true;
  } catch (err) {
    logger.error({ err, issueKey, screenshotPath }, "Network error attaching screenshot.");
    return false;
  }
}

/**
 * Top-level orchestrator called by agenticMeshRunner.ts.
 * Generates a bug description, creates a Jira Bug ticket, and attaches the screenshot.
 *
 * Returns a BugTicketCreated object on success, or null if anything fails.
 * This function NEVER throws — all errors are logged and swallowed.
 */
export async function reportBugToJira(
  options: BugTicketOptions
): Promise<BugTicketCreated | null> {
  const { result, testCase, parentTicketKey } = options;

  if (!isBugReporterConfigured()) {
    logger.warn(
      { testId: result.testId },
      "Bug reporter not configured (missing JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN / JIRA_PROJECT_KEY). Skipping."
    );
    return null;
  }

  const projectKey = process.env.JIRA_PROJECT_KEY!;
  const baseUrl = (process.env.JIRA_BASE_URL ?? "").replace(/\/$/, "");

  logger.info(
    { testId: result.testId, projectKey },
    "Initiating autonomous bug report for failed test..."
  );

  // Step 1: Generate AI bug description
  const { summary, fullReport } = await generateBugDescription(result, testCase);

  // Step 2: Build ADF document
  const adfDescription = buildAdfDescription(fullReport, parentTicketKey, result.screenshotPath);

  // Step 3: Create Jira Bug issue
  const issueKey = await createJiraBugTicket(summary, adfDescription, projectKey);
  if (!issueKey) {
    logger.error(
      { testId: result.testId },
      "Bug ticket creation failed — skipping screenshot attachment."
    );
    return null;
  }

  // Step 4: Attach screenshot (non-fatal if it fails)
  if (result.screenshotPath) {
    await attachScreenshotToJiraIssue(issueKey, result.screenshotPath);
  }

  const issueUrl = `${baseUrl}/browse/${issueKey}`;
  logger.info({ issueKey, issueUrl }, "Autonomous bug report complete.");

  return {
    issueKey,
    issueUrl,
    summary,
  };
}

