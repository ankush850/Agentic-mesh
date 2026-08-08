/**
 * End-to-end check for every bundled SQA demo ticket:
 *   acceptance criteria --(criteriaToSteps / LLM)--> test cases
 *                     --(AgenticMeshRunner + self-healing)--> pass/fail
 * Each ticket is run against its own demo page (file://) so we exercise the
 * real pipeline the console uses, without touching Jira.
 *
 * Run: npx tsx scripts/verify-all-sqa.ts
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { criteriaToSteps } from "../src/generator/criteriaToSteps";
import { AgenticMeshRunner } from "../src/runner/sentinelRunner";
import type { Ticket } from "../src/types";

type DemoTicket = {
  key: string;
  summary: string;
  demoFile: string;
  acceptanceCriteria: string[];
};

function fileUrl(demoFile: string): string {
  const abs = path.resolve(demoFile);
  return "file:///" + abs.replace(/\\/g, "/");
}

async function main() {
  const tickets: DemoTicket[] = JSON.parse(
    fs.readFileSync(path.resolve("fixtures", "demo-tickets.json"), "utf-8"),
  );

  const rows: { key: string; title: string; status: string; detail: string }[] = [];
  let failed = 0;

  for (const dt of tickets) {
    const ticket: Ticket = {
      key: dt.key,
      title: dt.summary,
      description: dt.summary,
      acceptanceCriteria: dt.acceptanceCriteria,
    };

    let cases;
    try {
      cases = await criteriaToSteps(ticket);
    } catch (err) {
      rows.push({ key: dt.key, title: "(generation failed)", status: "error", detail: (err as Error).message });
      failed++;
      continue;
    }

    const runner = new AgenticMeshRunner({ baseUrl: fileUrl(dt.demoFile), headless: true });
    let results;
    try {
      results = await runner.runTestCases(cases);
    } finally {
      await runner.close();
    }

    for (const r of results) {
      const ok = r.status === "passed" || r.status === "healed";
      if (!ok) failed++;
      if (!ok) {
        const tc = cases.find((c) => c.id === r.testId);
        console.log(
          `\n[FAIL DEBUG] ${dt.key} ${r.title}\n  expectedOutcome: ${JSON.stringify(tc?.expectedOutcome)}\n  steps: ${JSON.stringify(tc?.steps)}`,
        );
      }
      rows.push({
        key: dt.key,
        title: r.title,
        status: r.status,
        detail: ok
          ? r.repairs.length
            ? `healed x${r.repairs.length}`
            : ""
          : (r.error ?? "").split("\n")[0].slice(0, 90),
      });
    }
  }

  console.log("\n================  ALL SQA RESULTS  ================");
  for (const row of rows) {
    const mark = row.status === "passed" || row.status === "healed" ? "PASS" : "FAIL";
    console.log(
      `${mark}  ${row.key.padEnd(7)} ${row.status.padEnd(7)} ${row.title}` +
        (row.detail ? `   — ${row.detail}` : ""),
    );
  }
  const total = rows.length;
  console.log(`\n${total - failed}/${total} test cases OK across ${tickets.length} tickets.`);
  console.log(failed === 0 ? "ALL GREEN" : `${failed} FAILING`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
