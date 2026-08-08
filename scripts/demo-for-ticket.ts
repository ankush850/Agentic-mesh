    import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { JiraClient } from "../src/jira/jiraClient";
import { criteriaToSteps } from "../src/generator/criteriaToSteps";

async function main() {
  const key = process.argv[2] || "SQA-1";
  const client = new JiraClient({ strict: true });

  const ticket = await client.fetchTicket(key);
  console.log(`\n=== Jira ticket ${ticket.key} ===`);
  console.log(`${ticket.title}\n`);
  ticket.acceptanceCriteria.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));

  const testCases = await criteriaToSteps(ticket);
  console.log(`\n=== Generated ${testCases.length} test cases ===`);
  for (const tc of testCases) {
    console.log(`\n${tc.id} — ${tc.title}`);
    tc.steps.forEach((s, i) => console.log(`  ${i + 1}. ${s.description}`));
    console.log(`  ✔ Expected: ${tc.expectedOutcome}`);
  }

  const out = { ticket, testCases };
  const target = path.resolve("fixtures", `${ticket.key}-testcases.json`);
  fs.writeFileSync(target, JSON.stringify(out, null, 2), "utf-8");
  console.log(`\nSaved bundle → ${target}`);
}

main().catch((error) => {
  console.error("Demo generation failed:", (error as Error).message);
  process.exit(1);
});
