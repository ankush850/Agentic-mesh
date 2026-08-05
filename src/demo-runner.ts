import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import * as dotenv from "dotenv";
import { JiraClient } from "./jira/jiraClient";
import { criteriaToSteps } from "./generator/criteriaToSteps";
import { AgenticMeshRunner } from "./runner/sentinelRunner";
import { clearRepairs } from "./healing/repairLog";
import { generateReports, printCliSummary } from "./report/reportBuilder";
import { logger } from "./logger";

dotenv.config();

function openInBrowser(filePath: string) {
  try {
    const startCmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
    exec(`${startCmd} "" "${filePath}"`);
  } catch (err) {
    logger.warn({ err }, "Could not automatically open browser; file path printed to terminal.");
  }
}

async function runDemo() {
  console.log("\n" + "=".repeat(75));
  console.log("       🛡️  AGENTIC-MESH AUTONOMOUS DEMO & SELF-HEALING SHOWCASE  🛡️");
  console.log("=".repeat(75));

  // Reset repairs log for a fresh demo run
  clearRepairs();

  const demoPath = path.resolve(process.cwd(), "demo/index.html").replace(/\\/g, "/");
  const v1Url = `file:///${demoPath}`;
  const v2Url = `file:///${demoPath}?v=2`;

  // -------------------------------------------------------------
  // STEP 1: Load Mock Ticket
  // -------------------------------------------------------------
  console.log("\n[STEP 1/6] 📋 Ingesting Jira Acceptance Criteria...");
  const jiraClient = new JiraClient({ forceMock: true });
  const ticket = await jiraClient.fetchTicket("QA-101");
  console.log(` • Ticket Key:   ${ticket.key}`);
  console.log(` • Title:        ${ticket.title}`);
  console.log(` • User Story:   ${ticket.description}`);
  console.log(` • Criteria (${ticket.acceptanceCriteria.length}):`);
  ticket.acceptanceCriteria.forEach((ac, i) => console.log(`   ${i + 1}. ${ac}`));

  // -------------------------------------------------------------
  // STEP 2: Generate UI Tests
  // -------------------------------------------------------------
  console.log("\n[STEP 2/6] 🤖 Synthesizing Automated Test Cases...");
  const testCases = await criteriaToSteps(ticket);
  console.log(` • Successfully generated ${testCases.length} executable test cases:`);
  testCases.forEach((tc) => console.log(`   - ${tc.id}: ${tc.title} (${tc.steps.length} steps)`));

  // -------------------------------------------------------------
  // STEP 3: Baseline Run on Demo App v1 (Original DOM)
  // -------------------------------------------------------------
  console.log("\n[STEP 3/6] 🟢 Phase 1: Running Tests on Demo App v1 (Baseline)");
  console.log(` • Target: ${v1Url}`);
  const runnerV1 = new AgenticMeshRunner({
    baseUrl: v1Url,
    headless: true,
    repeatCount: 1,
  });
  const v1Results = await runnerV1.runTestCases(testCases);
  await runnerV1.close();

  const v1Passed = v1Results.filter((r) => r.status === "passed").length;
  console.log(` • Phase 1 Result: ${v1Passed}/${v1Results.length} passed cleanly on original DOM.`);

  // -------------------------------------------------------------
  // STEP 4 & 5: Refactor App to v2 & Execute Self-Healing Run
  // -------------------------------------------------------------
  console.log("\n[STEP 4/6] 🔄 Phase 2: Simulating UI Refactoring (App v2 Mode)");
  console.log(" • In v2, IDs, classes, and labels are refactored:");
  console.log("   - '#username' -> '#user-account-input'");
  console.log("   - '#password' -> '#user-secret-key'");
  console.log("   - '#login-btn' -> '#btn-submit-auth'");
  console.log("   - '#todo-input' -> '#task-entry-field'");
  console.log("   - '#add-todo-btn' -> '#create-task-button'");
  console.log("   - '#logout-btn' -> '#btn-terminate-session'");

  console.log("\n[STEP 5/6] 🟣 Executing Tests with Autonomous Self-Healing...");
  console.log(` • Target: ${v2Url}`);
  const runnerV2 = new AgenticMeshRunner({
    baseUrl: v2Url,
    headless: true,
    repeatCount: 1,
  });
  const v2Results = await runnerV2.runTestCases(testCases);
  await runnerV2.close();

  // -------------------------------------------------------------
  // STEP 6: Report Generation & CLI Summary
  // -------------------------------------------------------------
  console.log("\n[STEP 6/6] 📊 Compiling Agentic-mesh Self-Healing Report...");
  printCliSummary(v2Results, ticket);

  const { htmlPath, mdPath, summary } = generateReports(v2Results, ticket);
  console.log(`\n🎉 Showcase Completed Successfully!`);
  console.log(` • Passed / Self-Healed: ${summary.passed + summary.healed}/${summary.total}`);
  console.log(` • Auto-Repairs Applied:  ${summary.repairsCount}`);
  console.log(` • HTML Report:           file:///${htmlPath.replace(/\\/g, "/")}`);
  console.log(` • Markdown Report:       ${mdPath}`);
  console.log(` • Repairs Log (JSONL):   reports/repairs.jsonl`);

  console.log("\n🌐 Launching interactive HTML report in browser...");
  openInBrowser(htmlPath);
}

runDemo().catch((err) => {
  console.error("Demo failed with fatal error:", err);
  process.exit(1);
});
