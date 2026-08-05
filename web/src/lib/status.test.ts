import { describe, expect, it } from "vitest";
import type { RunStatus, StepStatus, TestResultStatus } from "../../../shared/contracts";
import {
  isTerminalRunStatus,
  runTone,
  stepTone,
  testTone,
  toneLabel,
  toneOf,
  tones,
} from "./status";

/**
 * The colour language is part of the product spec, so it is pinned here:
 * passed = green, failed = red, healed = amber, flaky = violet.
 */
describe("status tones", () => {
  it("maps every run status", () => {
    const expected: Record<RunStatus, string> = {
      queued: "queued",
      running: "running",
      passed: "passed",
      failed: "failed",
      cancelled: "queued",
      error: "failed",
    };

    for (const [status, tone] of Object.entries(expected)) {
      expect(runTone(status as RunStatus)).toBe(tone);
    }
  });

  it("maps every step status", () => {
    const expected: Record<StepStatus, string> = {
      pending: "queued",
      running: "running",
      passed: "passed",
      failed: "failed",
      healed: "healed",
    };

    for (const [status, tone] of Object.entries(expected)) {
      expect(stepTone(status as StepStatus)).toBe(tone);
    }
  });

  it("keeps the healing and flaky tones for test results", () => {
    const expected: Record<TestResultStatus, string> = {
      passed: "passed",
      failed: "failed",
      healed: "healed",
      flaky: "flaky",
    };

    for (const [status, tone] of Object.entries(expected)) {
      expect(testTone(status as TestResultStatus)).toBe(tone);
    }
  });

  it("falls back to the neutral tone for unknown strings", () => {
    expect(testTone("something-new")).toBe("queued");
    expect(toneOf("something-new")).toBe("queued");
  });

  it("resolves a status through the shared helper", () => {
    expect(toneOf("healed")).toBe("healed");
    expect(toneOf("running")).toBe("running");
    expect(toneOf("queued")).toBe("queued");
  });

  it("always pairs a tone with a readable label", () => {
    for (const tone of Object.keys(tones) as Array<keyof typeof tones>) {
      expect(toneLabel(tone)).not.toBe("");
    }
    expect(toneLabel("healed")).toBe("Healed");
    expect(toneLabel("flaky")).toBe("Flaky");
  });

  it("knows which run statuses are terminal", () => {
    expect(isTerminalRunStatus("passed")).toBe(true);
    expect(isTerminalRunStatus("failed")).toBe(true);
    expect(isTerminalRunStatus("cancelled")).toBe(true);
    expect(isTerminalRunStatus("error")).toBe(true);
    expect(isTerminalRunStatus("running")).toBe(false);
    expect(isTerminalRunStatus("queued")).toBe(false);
  });
});
