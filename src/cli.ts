#!/usr/bin/env node
import { Command } from "commander";
import * as dotenv from "dotenv";
import { JiraClient } from "./jira/jiraClient";
import { criteriaToSteps } from "./generator/criteriaToSteps";
import { AgenticMeshRunner } from "./runner/sentinelRunner";
import { generateReports, printCliSummary } from "./report/reportBuilder";
import { logger } from "./logger";

dotenv.config();

const program = new Command();

program
  .name("agentic-mesh")
  .description("Autonomous AI QA Agent with Locator Self-Healing and Jira Integration")
  .version("1.0.0");

program
  .command("run")
  .description("Run autonomous QA cycle from Jira ticket to test generation, execution, and self-healing report")
  .option("-t, --ticket <key>", "Jira ticket key (e.g. QA-101)")
  .option("-u, --url <url>", "Target application URL", "http://localhost:3000")
  .option("-m, --mock", "Force use of mock ticket fixture (fixtures/mock-ticket.json)", false)
  .option("-r, --repeat <number>", "Repeat count per test case for flaky detection", "1")
  .option("--post-to-jira", "Post test execution summary back to the Jira ticket as a comment", false)
  .option("--no-headless", "Run browser in headed mode for visual observation")
  .option("--slow-mo <ms>", "Slow motion delay in milliseconds", "0")
  .option("--auto-bug", "Automatically create a Jira Bug ticket for any permanently failed test", false)
  .action(async (options) => {
    try {
      console.log("\n🚀 Initializing Agentic-mesh Autonomous QA Cycle...");
      console.log(`Target URL: ${options.url}`);

      // 1. Fetch Ticket
      const jiraClient = new JiraClient({ forceMock: options.mock });
      const ticketKey = options.ticket || "QA-101";
      const ticket = await jiraClient.fetchTicket(ticketKey);

      console.log(`\n📋 Loaded Ticket: [${ticket.key}] ${ticket.title}`);
      console.log(`Found ${ticket.acceptanceCriteria.length} acceptance criteria.`);

      // 2. Generate Tests
      console.log("\n🤖 Generating test cases from acceptance criteria...");
      const testCases = await criteriaToSteps(ticket);
      console.log(`Generated ${testCases.length} executable test cases.`);

      // 3. Execute Tests with Self-Healing
      const repeatCount = parseInt(options.repeat, 10) || 1;
      const slowMo = parseInt(options.slowMo, 10) || 0;
      const runner = new AgenticMeshRunner({
        baseUrl: options.url,
        headless: options.headless !== false,
        repeatCount,
        slowMo,
        autoBug: Boolean(options.autoBug),
        parentTicketKey: ticketKey,
      });

      console.log(`\n⚡ Executing tests against ${options.url} (Repeats: ${repeatCount}, Headless: ${options.headless !== false})...`);
      const results = await runner.runTestCases(testCases);
      await runner.close();

      // 4. Generate Reports
      const { htmlPath, mdPath, summary } = generateReports(results, ticket);
      printCliSummary(results, ticket);

      console.log(`📊 Reports generated successfully:`);
      console.log(`   - HTML: ${htmlPath}`);
      console.log(`   - Markdown: ${mdPath}`);

      // 5. Post to Jira (Bonus)
      if (options.postToJira) {
        console.log(`\n📤 Posting results back to Jira ticket ${ticket.key}...`);
        const summaryText = `Agentic-mesh Autonomous Run Summary for ${ticket.key}:\nTotal Tests: ${summary.total} | Passed: ${summary.passed} | Healed: ${summary.healed} | Flaky: ${summary.flaky} | Failed: ${summary.failed}\nTotal Repairs Applied: ${summary.repairsCount}`;
        await jiraClient.postResult(ticket.key, summaryText);
      }

      // Print auto-created bug ticket links (--auto-bug)
      const buggedResults = results.filter((r) => r.bugTicket);
      if (buggedResults.length > 0) {
        console.log("\n🐛 Auto-Created Jira Bug Tickets:");
        for (const r of buggedResults) {
          console.log(`   [${r.testId}] ${r.bugTicket!.issueKey}  →  ${r.bugTicket!.issueUrl}`);
        }
      }

      console.log("✨ Agentic-mesh cycle completed.\n");
    } catch (err) {
      logger.error({ err }, "Fatal error during Agentic-mesh execution");
      console.error("\n❌ Execution failed:", (err as Error).message);
      process.exit(1);
    }
  });

program.parse(process.argv);

