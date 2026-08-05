import { describe, it, expect, beforeEach, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { RepairLogger } from "../healing/repairLog";
import { RepairRecord } from "../types";

describe("RepairLogger and JSONL Writer", () => {
  const testLogPath = path.resolve(process.cwd(), "reports/test-repairs.jsonl");
  let logger: RepairLogger;

  beforeEach(() => {
    logger = new RepairLogger(testLogPath);
    logger.clearRepairs();
  });

  afterAll(() => {
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }
  });

  it("logs repairs and reads them back correctly", () => {
    const record: RepairRecord = {
      timestamp: new Date().toISOString(),
      testId: "TC-01",
      stepIndex: 1,
      stepDescription: "Fill username with 'admin'",
      oldLocator: "#username",
      newLocator: "#user-account-input",
      reason: "Refactored input id",
      modelUsed: "groq/llama-3.3-70b-versatile",
      confidence: 0.96,
    };

    logger.logRepair(record);
    const readBack = logger.getRepairs();

    expect(readBack).toHaveLength(1);
    expect(readBack[0].oldLocator).toBe("#username");
    expect(readBack[0].newLocator).toBe("#user-account-input");
    expect(readBack[0].confidence).toBe(0.96);
  });

  it("clears repairs properly", () => {
    logger.logRepair({
      timestamp: new Date().toISOString(),
      testId: "TC-02",
      stepIndex: 0,
      stepDescription: "Click login",
      oldLocator: "#login-btn",
      newLocator: "#btn-submit-auth",
      reason: "Class and ID changed",
      modelUsed: "heuristic/similarity-matrix",
      confidence: 0.88,
    });

    expect(logger.getRepairs()).toHaveLength(1);
    logger.clearRepairs();
    expect(logger.getRepairs()).toHaveLength(0);
  });
});

