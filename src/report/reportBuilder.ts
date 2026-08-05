import * as fs from "fs";
import * as path from "path";
import { RepairRecord, TestResult, Ticket } from "../types";

export interface ReportSummary {
  total: number;
  passed: number;
  failed: number;
  healed: number;
  flaky: number;
  totalDurationMs: number;
  repairsCount: number;
  repairRecords: RepairRecord[];
}

export function computeSummary(results: TestResult[]): ReportSummary {
  let passed = 0;
  let failed = 0;
  let healed = 0;
  let flaky = 0;
  let totalDurationMs = 0;
  const allRepairs: RepairRecord[] = [];

  for (const r of results) {
    totalDurationMs += r.durationMs;
    allRepairs.push(...r.repairs);
    if (r.status === "passed") passed++;
    else if (r.status === "healed") healed++;
    else if (r.status === "flaky") flaky++;
    else if (r.status === "failed") failed++;
  }

  return {
    total: results.length,
    passed,
    failed,
    healed,
    flaky,
    totalDurationMs,
    repairsCount: allRepairs.length,
    repairRecords: allRepairs,
  };
}

/**
 * Builds self-contained HTML report.
 */
export function buildHtmlReport(results: TestResult[], ticket?: Ticket): string {
  const summary = computeSummary(results);
  const successRate =
    summary.total > 0
      ? Math.round(((summary.passed + summary.healed) / summary.total) * 100)
      : 0;

  const ticketSection = ticket
    ? `
    <div class="ticket-header">
      <div class="ticket-badge">JIRA TICKET: ${ticket.key}</div>
      <h2>${escapeHtml(ticket.title)}</h2>
      <p class="ticket-desc">${escapeHtml(ticket.description)}</p>
    </div>`
    : "";

  const repairRows = summary.repairRecords.length > 0
    ? summary.repairRecords
        .map((r, i) => {
          const confPercent = Math.round(r.confidence * 100);
          const confClass =
            confPercent >= 80 ? "conf-high" : confPercent >= 50 ? "conf-mid" : "conf-low";

          const beforeImg = r.beforeScreenshot
            ? `<div class="diff-screenshot"><strong>Before:</strong><img src="data:image/png;base64,${r.beforeScreenshot}" alt="Before Repair" /></div>`
            : "";
          const afterImg = r.afterScreenshot
            ? `<div class="diff-screenshot"><strong>After (Healed):</strong><img src="data:image/png;base64,${r.afterScreenshot}" alt="After Repair" /></div>`
            : "";
          const diffVisual =
            beforeImg || afterImg
              ? `<details class="screenshot-diff-details"><summary>View Before/After Comparison</summary><div class="diff-container">${beforeImg}${afterImg}</div></details>`
              : "";

          return `
          <tr>
            <td>#${i + 1} (${r.testId})</td>
            <td><code>${escapeHtml(r.oldLocator)}</code></td>
            <td><code class="healed-pill">${escapeHtml(r.newLocator)}</code></td>
            <td>
              <span class="reason-text">${escapeHtml(r.reason)}</span>
              ${diffVisual}
            </td>
            <td><span class="badge badge-model">${escapeHtml(r.modelUsed)}</span></td>
            <td>
              <div class="conf-bar-container">
                <div class="conf-bar ${confClass}" style="width: ${confPercent}%"></div>
                <span>${confPercent}%</span>
              </div>
            </td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="empty-state">No repairs required — all locators matched existing DOM selectors cleanly.</td></tr>`;

  const testRows = results
    .map((r) => {
      const statusClass = `status-${r.status}`;
      const repairsBadge =
        r.repairs.length > 0
          ? `<span class="badge badge-healed">${r.repairs.length} Repaired</span>`
          : "";
      const historyBadge =
        r.history && r.history.length > 1
          ? `<span class="badge badge-history">Runs: ${r.history.join(" &rarr; ")}</span>`
          : "";
      const errorSection = r.error
        ? `<div class="test-error"><strong>Error:</strong> ${escapeHtml(r.error)}</div>`
        : "";

      return `
      <div class="test-card ${statusClass}">
        <div class="test-card-header">
          <div class="test-title">
            <span class="status-indicator ${statusClass}">${r.status.toUpperCase()}</span>
            <strong>${escapeHtml(r.testId)}: ${escapeHtml(r.title)}</strong>
          </div>
          <div class="test-meta">
            ${repairsBadge}
            ${historyBadge}
            <span class="duration">${(r.durationMs / 1000).toFixed(2)}s</span>
          </div>
        </div>
        <div class="test-criterion"><strong>Criterion:</strong> ${escapeHtml(r.criterion)}</div>
        ${errorSection}
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agentic-mesh Autonomous Test & Self-Healing Report</title>
  <style>
    :root {
      /* Ocean Blue Serenity — the same ten tokens the console uses. The report
         is a standalone file with no build step, so the palette is declared
         here once and every rule below reads through it. This artefact is dark,
         so it takes the palette from its navy end: navy-950 page, navy-800
         cards, cyan accents, white text. */
      --navy-950: #03045E;
      --navy-800: #023E8A;
      --blue-600: #0077B6;
      --blue-500: #0096C7;
      --cyan-500: #00B4D8;
      --cyan-400: #48CAE4;
      --cyan-300: #90E0EF;
      --cyan-200: #ADE8F4;
      --cyan-100: #CAF0F8;
      --white: #FFFFFF;

      /* Status hues stay functional, exactly as in the console. */
      --success: #10b981;
      --healed: #8b5cf6;
      --warning: #f59e0b;
      --danger: #ef4444;

      --bg: var(--navy-950);
      --card-bg: color-mix(in srgb, var(--navy-800) 55%, var(--navy-950));
      --border: color-mix(in srgb, var(--cyan-400) 26%, transparent);
      --text: var(--white);
      --text-muted: var(--cyan-300);
      --primary: var(--cyan-400);

      /* Tints, shades and inks derived from the tokens above, so no rule below
         needs a colour literal of its own. */
      --tint-primary: color-mix(in srgb, var(--primary) 16%, transparent);
      --tint-white: color-mix(in srgb, var(--white) 12%, transparent);
      --tint-success: color-mix(in srgb, var(--success) 20%, transparent);
      --tint-healed: color-mix(in srgb, var(--healed) 24%, transparent);
      --tint-warning: color-mix(in srgb, var(--warning) 20%, transparent);
      --tint-danger: color-mix(in srgb, var(--danger) 18%, transparent);
      --shade-weak: color-mix(in srgb, var(--navy-950) 55%, transparent);
      --shade-strong: color-mix(in srgb, var(--navy-950) 72%, transparent);
      --border-healed: color-mix(in srgb, var(--healed) 40%, transparent);
      --border-danger: color-mix(in srgb, var(--danger) 32%, transparent);
      /* Raw green/amber/red are dark enough to fail AA as text on a navy card,
         and violet/red fail outright, so status TEXT uses a pale ink mixed
         toward white while the fills keep the true hue. */
      --ink-success: color-mix(in srgb, var(--success) 60%, var(--white));
      --ink-healed: color-mix(in srgb, var(--healed) 45%, var(--white));
      --ink-warning: color-mix(in srgb, var(--warning) 60%, var(--white));
      --ink-danger: color-mix(in srgb, var(--danger) 45%, var(--white));
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    .logo-group h1 { font-size: 1.875rem; font-weight: 700; color: var(--text); }
    .logo-group .subtitle { color: var(--primary); font-size: 0.95rem; font-weight: 500; }
    .report-date { color: var(--text-muted); font-size: 0.875rem; text-align: right; }

    .ticket-header {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-left: 4px solid var(--primary);
      padding: 1.25rem;
      border-radius: 8px;
      margin-bottom: 2rem;
    }
    .ticket-badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--primary);
      background: var(--tint-primary);
      padding: 2px 8px;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }
    .ticket-desc { color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem; }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 2.5rem;
    }
    .metric-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem;
      text-align: center;
    }
    .metric-value { font-size: 2.25rem; font-weight: 700; margin-top: 0.25rem; }
    .metric-label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
    .val-primary { color: var(--primary); }
    .val-success { color: var(--ink-success); }
    .val-healed { color: var(--ink-healed); }
    .val-warning { color: var(--ink-warning); }
    .val-danger { color: var(--ink-danger); }

    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .section-title .count {
      background: var(--tint-white);
      font-size: 0.8rem;
      padding: 2px 8px;
      border-radius: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 2.5rem;
    }
    th, td {
      padding: 0.875rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 0.875rem;
    }
    th {
      background: var(--shade-weak);
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }
    tr:last-child td { border-bottom: none; }
    code {
      background: var(--shade-strong);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.825rem;
      color: var(--cyan-100);
    }
    code.healed-pill {
      background: var(--tint-healed);
      color: var(--ink-healed);
      border: 1px solid var(--border-healed);
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .badge-model { background: var(--tint-primary); color: var(--cyan-100); }
    .badge-healed { background: var(--tint-healed); color: var(--ink-healed); }
    .badge-history { background: var(--tint-warning); color: var(--ink-warning); }

    .conf-bar-container { display: flex; align-items: center; gap: 0.5rem; width: 100px; }
    .conf-bar { height: 6px; border-radius: 3px; }
    .conf-high { background: var(--success); }
    .conf-mid { background: var(--warning); }
    .conf-low { background: var(--danger); }

    .test-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem;
      margin-bottom: 1rem;
      transition: border-color 0.2s;
    }
    .test-card.status-passed { border-left: 4px solid var(--success); }
    .test-card.status-healed { border-left: 4px solid var(--healed); }
    .test-card.status-flaky { border-left: 4px solid var(--warning); }
    .test-card.status-failed { border-left: 4px solid var(--danger); }

    .test-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .test-title { display: flex; align-items: center; gap: 0.75rem; font-size: 1rem; }
    .status-indicator {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .status-passed { background: var(--tint-success); color: var(--ink-success); }
    .status-healed { background: var(--tint-healed); color: var(--ink-healed); }
    .status-flaky { background: var(--tint-warning); color: var(--ink-warning); }
    .status-failed { background: var(--tint-danger); color: var(--ink-danger); }
    .test-meta { display: flex; align-items: center; gap: 0.5rem; }
    .duration { color: var(--text-muted); font-size: 0.85rem; }
    .test-criterion { font-size: 0.875rem; color: var(--text-muted); }
    .test-error {
      background: var(--tint-danger);
      border: 1px solid var(--border-danger);
      color: var(--ink-danger);
      padding: 0.75rem;
      border-radius: 6px;
      margin-top: 0.75rem;
      font-size: 0.85rem;
    }

    .diff-container {
      display: flex;
      gap: 1rem;
      margin-top: 0.5rem;
      overflow-x: auto;
    }
    .diff-screenshot img {
      max-width: 320px;
      border-radius: 6px;
      border: 1px solid var(--border);
      display: block;
      margin-top: 4px;
    }
    .screenshot-diff-details { margin-top: 6px; font-size: 0.8rem; cursor: pointer; color: var(--primary); }
    .empty-state { text-align: center; color: var(--text-muted); padding: 2rem !important; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-group">
        <h1>Agentic-mesh</h1>
        <div class="subtitle">Autonomous AI Regression & Locator Self-Healing Engine</div>
      </div>
      <div class="report-date">
        Generated: ${new Date().toLocaleString()}<br />
        Engine: bug0inc/qa-agent + Healenium Similarity
      </div>
    </header>

    ${ticketSection}

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Total Tests</div>
        <div class="metric-value val-primary">${summary.total}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Success Rate</div>
        <div class="metric-value val-success">${successRate}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Clean Passes</div>
        <div class="metric-value val-success">${summary.passed}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Self-Healed</div>
        <div class="metric-value val-healed">${summary.healed}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Flaky Tests</div>
        <div class="metric-value val-warning">${summary.flaky}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Failed</div>
        <div class="metric-value val-danger">${summary.failed}</div>
      </div>
    </div>

    <div class="section-title">
      <span>Auto-Healing Repair Log</span>
      <span class="count">${summary.repairsCount} repairs recorded</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Step / Test</th>
          <th>Original Locator</th>
          <th>Self-Healed Locator</th>
          <th>Reason & Changes</th>
          <th>Resolver Model</th>
          <th>Confidence</th>
        </tr>
      </thead>
      <tbody>
        ${repairRows}
      </tbody>
    </table>

    <div class="section-title">
      <span>Test Execution Breakdown</span>
      <span class="count">${results.length} tests</span>
    </div>
    <div class="tests-list">
      ${testRows}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Builds Markdown summary report.
 */
export function buildMarkdownReport(results: TestResult[], ticket?: Ticket): string {
  const summary = computeSummary(results);

  let md = `# Agentic-mesh Autonomous Test Run Report\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n`;
  if (ticket) {
    md += `**Jira Ticket:** ${ticket.key} - ${ticket.title}\n`;
  }
  md += `\n## Summary\n\n`;
  md += `| Total Tests | Passed | Self-Healed | Flaky | Failed | Duration |\n`;
  md += `| :---: | :---: | :---: | :---: | :---: | :---: |\n`;
  md += `| ${summary.total} | ${summary.passed} | ${summary.healed} | ${summary.flaky} | ${summary.failed} | ${(summary.totalDurationMs / 1000).toFixed(2)}s |\n\n`;

  md += `## Self-Healing Repairs (${summary.repairsCount})\n\n`;
  if (summary.repairRecords.length > 0) {
    md += `| Test ID | Step | Old Locator | Repaired Locator | Reason | Confidence | Model |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    for (const r of summary.repairRecords) {
      md += `| ${r.testId} | ${r.stepIndex + 1} | \`${r.oldLocator}\` | \`${r.newLocator}\` | ${r.reason} | ${Math.round(r.confidence * 100)}% | ${r.modelUsed} |\n`;
    }
  } else {
    md += `_No repairs required. All locators matched current page DOM._\n`;
  }
  md += `\n## Test Cases\n\n`;
  for (const r of results) {
    const icon = r.status === "passed" ? "✅" : r.status === "healed" ? "🟣" : r.status === "flaky" ? "⚠️" : "❌";
    md += `### ${icon} ${r.testId}: ${r.title} (${r.status.toUpperCase()})\n`;
    md += `- **Criterion:** ${r.criterion}\n`;
    md += `- **Duration:** ${(r.durationMs / 1000).toFixed(2)}s\n`;
    if (r.repairs.length > 0) {
      md += `- **Repairs:** ${r.repairs.length} locator(s) automatically healed\n`;
    }
    if (r.error) {
      md += `- **Error:** \`${r.error}\`\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * Prints formatted CLI summary table to the console.
 */
export function printCliSummary(results: TestResult[], ticket?: Ticket): void {
  const summary = computeSummary(results);

  console.log("\n" + "=".repeat(70));
  console.log("                AGENTIC-MESH EXECUTION SUMMARY");
  console.log("=".repeat(70));
  if (ticket) {
    console.log(`Ticket: [${ticket.key}] ${ticket.title}`);
  }
  console.log(`Total: ${summary.total} | Passed: ${summary.passed} | Healed: ${summary.healed} | Flaky: ${summary.flaky} | Failed: ${summary.failed}`);
  console.log(`Execution Time: ${(summary.totalDurationMs / 1000).toFixed(2)}s | Total Repairs: ${summary.repairsCount}`);
  console.log("-".repeat(70));

  for (const r of results) {
    const tag = r.status === "passed"
      ? "[PASS]   "
      : r.status === "healed"
      ? "[HEALED] "
      : r.status === "flaky"
      ? "[FLAKY]  "
      : "[FAIL]   ";
    const repairNote = r.repairs.length > 0 ? ` (${r.repairs.length} repairs)` : "";
    console.log(`${tag} ${r.testId}: ${r.title}${repairNote} [${(r.durationMs / 1000).toFixed(2)}s]`);
    if (r.error) {
      console.log(`         Error: ${r.error}`);
    }
  }

  if (summary.repairRecords.length > 0) {
    console.log("-".repeat(70));
    console.log("REPAIRS APPLIED:");
    for (const rep of summary.repairRecords) {
      console.log(` • [${rep.testId}] "${rep.oldLocator}" -> "${rep.newLocator}" (${Math.round(rep.confidence * 100)}% conf via ${rep.modelUsed})`);
    }
  }
  console.log("=".repeat(70) + "\n");
}

/**
 * Saves HTML and Markdown reports to disk.
 */
export function generateReports(
  results: TestResult[],
  ticket?: Ticket,
  options: { outputDir?: string } = {}
): { htmlPath: string; mdPath: string; summary: ReportSummary } {
  const outputDir = options.outputDir || path.resolve(process.cwd(), "reports");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const summary = computeSummary(results);
  const htmlContent = buildHtmlReport(results, ticket);
  const mdContent = buildMarkdownReport(results, ticket);

  const htmlPath = path.join(outputDir, "report.html");
  const mdPath = path.join(outputDir, "report.md");

  fs.writeFileSync(htmlPath, htmlContent, "utf-8");
  fs.writeFileSync(mdPath, mdContent, "utf-8");

  return { htmlPath, mdPath, summary };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

