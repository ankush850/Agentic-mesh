import * as fs from "fs";
import * as path from "path";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { z } from "zod";
import { BugTicketResult, ElementCandidate, RepairRecord, TestCase, TestCaseStep, TestResult, TestResultStatus } from "../types";
import { rankCandidates } from "../healing/similarity";
import { logRepair } from "../healing/repairLog";
import { generateJSON, getLLMStatus } from "../llm/provider";
import { safeSnapshot, verifyActionEffect } from "../utils";
import { logger } from "../logger";
import { reportBugToJira } from "../jira/bugReporter";
import type { AppModel } from "../repo/astParser";
import { tryAstDeterministicHealing } from "../repo/astHealingHints";

export interface RunnerOptions {
  baseUrl: string;
  headless?: boolean;
  repeatCount?: number;
  slowMo?: number;
  screenshotDir?: string;
  appModel?: AppModel;
  /**
   * Optional observation hooks. Every field is optional and defaults to a
   * no-op, so existing callers (CLI, `npm run demo`) are unaffected.
   */
  hooks?: RunnerHooks;
  /**
   * When true, automatically create a Jira Bug ticket for any test that
   * reaches final status "failed" (after all repeat runs). Requires
   * JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY in .env.
   */
  autoBug?: boolean;
  /**
   * The parent Jira ticket key (e.g. "QA-101") used as the reference link
   * in the auto-created bug description. Defaults to "UNKNOWN" if not provided.
   */
  parentTicketKey?: string;
}

/**
 * Additive, side-effect-free observation surface used by the UI API layer to
 * stream progress over SSE. Hooks are always called through `safeCall`, so a
 * throwing hook can never fail a test run.
 */
export interface RunnerHooks {
  onRunStart?: (info: { totalTests: number }) => void;
  onTestStart?: (info: { testId: string; title: string }) => void;
  onStepStart?: (info: { testId: string; stepIndex: number; description: string }) => void;
  onReasoning?: (info: { testId: string; stepIndex: number; text: string }) => void;
  onStepHealing?: (info: {
    testId: string;
    stepIndex: number;
    reason: string;
    oldLocator: string;
  }) => void;
  onStepHealed?: (info: {
    testId: string;
    stepIndex: number;
    oldLocator: string;
    newLocator: string;
    modelUsed: string;
    confidence: number;
    screenshotBefore?: string;
    screenshotAfter?: string;
  }) => void;
  onStepEnd?: (info: {
    testId: string;
    stepIndex: number;
    durationMs: number;
    repaired: boolean;
  }) => void;
  onStepFailed?: (info: { testId: string; stepIndex: number; error: string }) => void;
  onTestEnd?: (info: { testId: string; result: TestResult }) => void;
  onRunEnd?: (info: { results: TestResult[] }) => void;
  /** Polled between tests and between steps; returning true stops the run. */
  isCancelled?: () => boolean;
}

function safeCall<T>(fn: ((arg: T) => void) | undefined, arg: T): void {
  if (!fn) return;
  try {
    fn(arg);
  } catch {
    // Observation hooks must never break a test run.
  }
}

const RepairDecisionSchema = z.object({
  selectedLocator: z.string(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});

/** Pulls quoted literals ('x' or "x") out of a natural-language string. */
export function extractQuoted(text: string): string[] {
  const out: string[] = [];
  for (const pattern of [/'([^']+)'/g, /"([^"]+)"/g]) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text))) {
      const value = m[1].trim();
      if (value) out.push(value);
    }
  }
  return out;
}

/**
 * Turns an expectedOutcome into the concrete text that must appear on the page.
 * LLMs usually phrase it as a sentence ("the list shows 'Bread'"), so we prefer
 * the quoted literals; only when none exist do we match the whole string.
 */
export function outcomeLiterals(outcome: string): string[] {
  const literals = extractQuoted(outcome);
  if (literals.length > 0) return literals;
  const trimmed = outcome.trim();
  return trimmed ? [trimmed] : [];
}

/** True when a step describes a verification rather than a user interaction. */
export function isAssertionStep(step: TestCaseStep): boolean {
  const desc = step.description.toLowerCase();
  return (
    step.action === "assert" ||
    step.action === "verify" ||
    step.action === "expect" ||
    /^(verify|assert|expect|ensure|check)\b/.test(desc) ||
    /\b(is|are|should be|should)\s+(visible|displayed|shown|present)\b/.test(desc)
  );
}

/**
 * Extracts visible interactive candidate elements from the current page DOM.
 */
export async function extractPageCandidates(page: Page): Promise<ElementCandidate[]> {
  try {
    return await page.evaluate(() => {
      const list: ElementCandidate[] = [];
      const doc = (globalThis as any).document;
      const win = (globalThis as any).window;
      if (!doc) return list;

      const elements = doc.querySelectorAll(
        "input, button, a, select, textarea, [role='button'], [role='textbox'], [role='link']"
      );

      elements.forEach((el: any, index: number) => {
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
        const style = win.getComputedStyle ? win.getComputedStyle(el) : {};
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0" ||
          (rect.width === 0 && rect.height === 0)
        ) {
          return;
        }

        const tag = (el.tagName || "").toLowerCase();
        const id = el.id || undefined;
        const name = el.name || undefined;
        const type = el.type || undefined;
        const placeholder = el.placeholder || undefined;
        const role = el.getAttribute ? el.getAttribute("role") : undefined;
        const ariaLabel = el.getAttribute ? el.getAttribute("aria-label") : undefined;
        const text = (el.innerText || el.textContent || "").trim();
        const classes = Array.from(el.classList || []) as string[];

        let locator = "";
        if (id) {
          locator = `#${id}`;
        } else if (name) {
          locator = `${tag}[name='${name}']`;
        } else if (placeholder) {
          locator = `${tag}[placeholder='${placeholder}']`;
        } else if (text && (tag === "button" || tag === "a" || role === "button")) {
          locator = `${tag}:has-text("${text.slice(0, 30)}")`;
        } else if (classes.length > 0) {
          locator = `${tag}.${classes.join(".")}`;
        } else {
          locator = `${tag}:nth-of-type(${index + 1})`;
        }

        list.push({
          tag,
          id,
          name,
          type,
          classes,
          text: text.slice(0, 60),
          placeholder,
          role,
          ariaLabel,
          locator,
        });
      });
      return list;
    });
  } catch {
    return [];
  }
}

export class AgenticMeshRunner {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private options: RunnerOptions;
  private screenshotDir: string;
  private hooks: RunnerHooks;

  private isCancelled(): boolean {
    try {
      return this.hooks.isCancelled?.() ?? false;
    } catch {
      return false;
    }
  }

  constructor(options: RunnerOptions) {
    this.options = {
      headless: options.headless ?? true,
      repeatCount: options.repeatCount ?? 1,
      slowMo: options.slowMo ?? 0,
      ...options,
    };
    this.hooks = options.hooks ?? {};
    this.screenshotDir =
      options.screenshotDir || path.resolve(process.cwd(), "reports/screenshots");
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  public async init() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: this.options.headless,
        slowMo: this.options.slowMo,
      });
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
      });
    }
  }

  public async close() {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  /**
   * Attempts to heal a broken locator using similarity scoring + LLM fallback.
   */
  private async healLocator(
    page: Page,
    testId: string,
    stepIndex: number,
    step: TestCaseStep,
    oldLocator: string,
    beforeScreenshotBase64?: string
  ): Promise<{ newLocator: string; reason: string; modelUsed: string; confidence: number }> {
    logger.info({ testId, stepIndex, oldLocator }, "Initiating locator self-healing...");

    const candidates = await extractPageCandidates(page);

    // Tier 0: AST Structure and Fingerprint Healing (Deterministic)
    if (this.options.appModel) {
      try {
        const tier0Repair = await tryAstDeterministicHealing({
          page,
          oldLocator,
          appModel: this.options.appModel,
          candidates,
        });
        if (tier0Repair) {
          logger.info(
            { testId, stepIndex, oldLocator, newLocator: tier0Repair.newLocator },
            "Tier 0 AST structure repair resolved successfully."
          );
          return {
            newLocator: tier0Repair.newLocator,
            reason: tier0Repair.reason,
            modelUsed: "ast-fingerprint/tier-0",
            confidence: tier0Repair.confidence,
          };
        }
      } catch (tier0Err) {
        logger.debug({ tier0Err }, "Tier 0 AST healing evaluation skipped on error.");
      }
    }
    const ranked = rankCandidates(oldLocator, candidates, 0.25);

    if (ranked.length === 0) {
      throw new Error(`Self-healing failed: no viable candidate elements found for locator "${oldLocator}"`);
    }

    const topCandidate = ranked[0];
    const status = getLLMStatus();

    // If LLM is available, consult it for higher fidelity decision
    if (status.groqAvailable || status.geminiAvailable) {
      const prompt = `
A browser test step failed because its locator could not find the element.

Failed step description: "${step.description}"
Failed locator: "${oldLocator}"
Action required: "${step.action || "interact"}"

Here are the top candidate elements discovered on the page, scored by similarity:
${ranked.slice(0, 5).map((c, i) => `${i + 1}. locator: "${c.locator}" | tag: <${c.tag}> | id: "${c.id || ""}" | text: "${c.text || ""}" | placeholder: "${c.placeholder || ""}" | similarity score: ${c.score} | reasons: ${c.matchReasons?.join(", ")}`).join("\n")}

Select the best replacement locator for the step, explain the repair reason (what changed in the DOM), and provide your confidence score between 0.0 and 1.0.

Return JSON in this format:
{
  "selectedLocator": "...",
  "reason": "...",
  "confidence": 0.95
}
`;
      try {
        const decision = await generateJSON(prompt, RepairDecisionSchema, {
          systemPrompt: "You are an expert self-healing test automation agent.",
        });
        return {
          newLocator: decision.data.selectedLocator,
          reason: decision.data.reason,
          modelUsed: decision.modelUsed,
          confidence: decision.data.confidence,
        };
      } catch (err) {
        logger.warn({ err }, "LLM locator decision failed, falling back to top similarity match.");
      }
    }

    // Heuristic / Healenium similarity decision
    const reasonsStr = topCandidate.matchReasons?.join("; ") || "Matched by tag and semantic similarity";
    return {
      newLocator: topCandidate.locator,
      reason: `Self-healed via similarity scoring: ${reasonsStr}`,
      modelUsed: "heuristic/similarity-matrix",
      confidence: topCandidate.score || 0.85,
    };
  }

  /**
   * Executes a single step with auto-healing on locator failure.
   */
  private async executeStep(
    page: Page,
    testId: string,
    stepIndex: number,
    step: TestCaseStep
  ): Promise<RepairRecord | null> {
    logger.debug({ testId, stepIndex, description: step.description }, "Executing step");

    safeCall(this.hooks.onReasoning, {
      testId,
      stepIndex,
      text: `Resolving target for step ${stepIndex + 1}: ${step.description}`,
    });

    if (step.action === "navigate" || step.description.toLowerCase().startsWith("navigate")) {
      await page.goto(this.options.baseUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
      return null;
    }

    const isAssert = isAssertionStep(step);

    // Determine initial target locator
    let locator = step.target;
    if (!locator) {
      if (isAssert) {
        const quoted = extractQuoted(step.description)[0];
        locator = quoted ? `text=${quoted}` : "body";
      } else if (step.description.toLowerCase().includes("username")) {
        locator = "#username, [name='username'], input[type='text']";
      } else if (step.description.toLowerCase().includes("password")) {
        locator = "#password, [name='password'], input[type='password']";
      } else if (step.description.toLowerCase().includes("login") || step.description.toLowerCase().includes("sign in")) {
        locator = "#login-btn, button[type='submit'], button:has-text('Login')";
      } else if (step.description.toLowerCase().includes("task") || step.description.toLowerCase().includes("todo")) {
        locator = "#todo-input, input[placeholder*='task']";
      } else if (step.description.toLowerCase().includes("logout")) {
        locator = "#logout-btn, button:has-text('Logout')";
      } else {
        locator = "button, input, a";
      }
    }

    const value = step.value || step.data?.value || "";
    const isFill =
      !isAssert &&
      (step.action === "fill" ||
        step.description.toLowerCase().startsWith("fill") ||
        step.description.toLowerCase().startsWith("type"));
    const verb = isAssert ? "assert" : isFill ? "fill" : "click";

    safeCall(this.hooks.onReasoning, {
      testId,
      stepIndex,
      text: `Candidate locator: ${locator} (action: ${verb})`,
    });

    let repairRecord: RepairRecord | null = null;
    let initialAttemptSucceeded = false;

    // Snapshot before action for verifyActionEffect check
    let snapshotBefore = "";
    try {
      snapshotBefore = await safeSnapshot(page, 2000);
    } catch {
      // ignore
    }

    // Attempt 1: Try current locator
    try {
      const loc = page.locator(locator).first();
      await loc.waitFor({ state: "visible", timeout: 1500 });

      if (!isAssert) {
        if (isFill) {
          await loc.fill(value, { timeout: 1500 });
        } else {
          await loc.click({ timeout: 1500 });
        }

        // Check if action had an effect
        if (snapshotBefore) {
          await verifyActionEffect(page, isFill ? "fill" : "click", snapshotBefore).catch(() => {});
        }
      }

      initialAttemptSucceeded = true;
    } catch (err) {
      logger.debug({ err: (err as Error).message }, `Step locator "${locator}" failed, triggering self-healing...`);
      initialAttemptSucceeded = false;
    }

    // If initial attempt failed, heal the locator
    if (!initialAttemptSucceeded) {
      safeCall(this.hooks.onStepHealing, {
        testId,
        stepIndex,
        reason: `Locator "${locator}" matched nothing - scanning the DOM for the closest replacement.`,
        oldLocator: locator,
      });

      const beforeScreenshotBase64 = (await page.screenshot({ fullPage: false })).toString("base64");
      const healing = await this.healLocator(page, testId, stepIndex, step, locator, beforeScreenshotBase64);

      // Execute repaired action
      const repairedLoc = page.locator(healing.newLocator).first();
      await repairedLoc.waitFor({ state: "visible", timeout: 2500 });

      if (!isAssert) {
        if (isFill) {
          await repairedLoc.fill(value, { timeout: 2000 });
        } else {
          await repairedLoc.click({ timeout: 2000 });
        }
      }

      const afterScreenshotBase64 = (await page.screenshot({ fullPage: false })).toString("base64");

      repairRecord = {
        timestamp: new Date().toISOString(),
        testId,
        stepIndex,
        stepDescription: step.description,
        oldLocator: locator,
        newLocator: healing.newLocator,
        reason: healing.reason,
        modelUsed: healing.modelUsed,
        confidence: healing.confidence,
        beforeScreenshot: beforeScreenshotBase64,
        afterScreenshot: afterScreenshotBase64,
      };

      logRepair(repairRecord);

      safeCall(this.hooks.onStepHealed, {
        testId,
        stepIndex,
        oldLocator: repairRecord.oldLocator,
        newLocator: repairRecord.newLocator,
        modelUsed: repairRecord.modelUsed,
        confidence: repairRecord.confidence,
        screenshotBefore: beforeScreenshotBase64,
        screenshotAfter: afterScreenshotBase64,
      });
    }

    return repairRecord;
  }

  /**
   * Runs a single test case once.
   */
  private async runSingleAttempt(
    testCase: TestCase,
    page: Page
  ): Promise<{ status: "passed" | "failed" | "healed"; repairs: RepairRecord[]; error?: string; stepsExecuted: number; screenshotPath?: string }> {
    const repairs: RepairRecord[] = [];
    let stepsExecuted = 0;

    try {
      for (let i = 0; i < testCase.steps.length; i++) {
        if (this.isCancelled()) {
          throw new Error("Run cancelled by user");
        }
        const step = testCase.steps[i];
        const stepStart = Date.now();
        safeCall(this.hooks.onStepStart, {
          testId: testCase.id,
          stepIndex: i,
          description: step.description,
        });

        let repair: RepairRecord | null = null;
        try {
          repair = await this.executeStep(page, testCase.id, i, step);
        } catch (err) {
          safeCall(this.hooks.onStepFailed, {
            testId: testCase.id,
            stepIndex: i,
            error: (err as Error).message,
          });
          safeCall(this.hooks.onStepEnd, {
            testId: testCase.id,
            stepIndex: i,
            durationMs: Date.now() - stepStart,
            repaired: false,
          });
          throw err;
        }

        if (repair) {
          repairs.push(repair);
        }
        stepsExecuted++;
        safeCall(this.hooks.onStepEnd, {
          testId: testCase.id,
          stepIndex: i,
          durationMs: Date.now() - stepStart,
          repaired: Boolean(repair),
        });
      }

      // Verify expected outcome
      if (testCase.expectedOutcome) {
        for (const needle of outcomeLiterals(testCase.expectedOutcome)) {
          const normalizedNeedle = needle.replace(/\s+/g, " ").trim();
          await page.waitForFunction(
            (text) => {
              const hay = (((globalThis as any).document?.body?.innerText || "") as string).replace(
                /\s+/g,
                " ",
              );
              return hay.includes(text);
            },
            normalizedNeedle,
            { timeout: 5000 },
          );
        }
      }

      const finalStatus = repairs.length > 0 ? "healed" : "passed";
      return { status: finalStatus, repairs, stepsExecuted };
    } catch (err) {
      const errorMsg = (err as Error).message;
      const screenshotFilename = `failure-${testCase.id}-${Date.now()}.png`;
      const screenshotPath = path.join(this.screenshotDir, screenshotFilename);

      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

      return {
        status: "failed",
        repairs,
        error: errorMsg,
        stepsExecuted,
        screenshotPath,
      };
    }
  }

  /**
   * Executes a list of TestCases, supporting flaky test detection via repeats.
   */
  public async runTestCases(testCases: TestCase[]): Promise<TestResult[]> {
    await this.init();
    if (!this.context) throw new Error("Browser context not initialized");

    const results: TestResult[] = [];
    const repeatCount = this.options.repeatCount ?? 1;

    safeCall(this.hooks.onRunStart, { totalTests: testCases.length });

    for (const testCase of testCases) {
      if (this.isCancelled()) {
        logger.warn({ id: testCase.id }, "Run cancelled before starting test.");
        break;
      }
      logger.info({ id: testCase.id, title: testCase.title, repeatCount }, "Starting test execution...");
      safeCall(this.hooks.onTestStart, { testId: testCase.id, title: testCase.title });
      const startTime = Date.now();
      const runHistory: ("passed" | "failed" | "healed")[] = [];
      let lastResult: any = null;
      let accumulatedRepairs: RepairRecord[] = [];

      for (let run = 0; run < repeatCount; run++) {
        const page = await this.context.newPage();
        try {
          const attemptResult = await this.runSingleAttempt(testCase, page);
          runHistory.push(attemptResult.status);
          lastResult = attemptResult;
          accumulatedRepairs = [...accumulatedRepairs, ...attemptResult.repairs];
        } finally {
          await page.close().catch(() => {});
        }
      }

      const durationMs = Date.now() - startTime;

      // Determine final status
      let finalStatus: TestResultStatus = "passed";
      const hasPass = runHistory.some((s) => s === "passed" || s === "healed");
      const hasFail = runHistory.some((s) => s === "failed");

      if (runHistory.length > 1 && hasPass && hasFail) {
        // Mixed results across runs indicates a flaky test!
        finalStatus = "flaky";
        logger.warn({ id: testCase.id, history: runHistory }, "[FLAKY TEST DETECTED] Test produced inconsistent results across runs.");
      } else if (runHistory.every((s) => s === "failed")) {
        finalStatus = "failed";
      } else if (accumulatedRepairs.length > 0) {
        finalStatus = "healed";
      } else {
        finalStatus = "passed";
      }

      // Deduplicate repairs by stepIndex
      const uniqueRepairsMap = new Map<number, RepairRecord>();
      for (const r of accumulatedRepairs) {
        if (!uniqueRepairsMap.has(r.stepIndex)) {
          uniqueRepairsMap.set(r.stepIndex, r);
        }
      }
      const uniqueRepairs = Array.from(uniqueRepairsMap.values());

      // Autonomous bug reporter: create a Jira Bug ticket for permanently failed tests.
      let bugTicket: BugTicketResult | undefined = undefined;
      if (finalStatus === "failed" && this.options.autoBug) {
        const partialResult: TestResult = {
          testId: testCase.id,
          title: testCase.title,
          criterion: testCase.criterion,
          status: finalStatus,
          durationMs,
          repairs: uniqueRepairs,
          screenshotPath: lastResult?.screenshotPath,
          error: lastResult?.error,
          stepsExecuted: lastResult?.stepsExecuted ?? testCase.steps.length,
          history: runHistory,
        };
        const bugResult = await reportBugToJira({
          result: partialResult,
          testCase,
          parentTicketKey: this.options.parentTicketKey ?? "UNKNOWN",
        });
        if (bugResult) {
          bugTicket = bugResult;
          logger.info(
            { testId: testCase.id, issueKey: bugResult.issueKey, issueUrl: bugResult.issueUrl },
            "Auto-bug ticket linked to failed test result."
          );
        }
      }

      results.push({
        testId: testCase.id,
        title: testCase.title,
        criterion: testCase.criterion,
        status: finalStatus,
        durationMs,
        repairs: uniqueRepairs,
        screenshotPath: lastResult?.screenshotPath,
        error: lastResult?.error,
        stepsExecuted: lastResult?.stepsExecuted ?? testCase.steps.length,
        history: runHistory,
        bugTicket,
      });

      safeCall(this.hooks.onTestEnd, { testId: testCase.id, result: results[results.length - 1] });

      logger.info(
        { id: testCase.id, status: finalStatus, durationMs, repairsCount: uniqueRepairs.length },
        `Finished test ${testCase.id}: ${finalStatus.toUpperCase()}`
      );
    }

    safeCall(this.hooks.onRunEnd, { results });
    return results;
  }
}
