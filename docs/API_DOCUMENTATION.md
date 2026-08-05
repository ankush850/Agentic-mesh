# API & CLI Documentation

> **Complete Reference for the Agentic-mesh Command-Line Interface, Programmatic TypeScript APIs, and Data Schemas**

---

## 1. Command-Line Interface (CLI)

The Agentic-mesh CLI is built with Commander.js and provides end-to-end automation execution.

### 1.1 Command Syntax
```powershell
npm run agentic-mesh -- run [options]
```

### 1.2 CLI Options & Flags

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-t, --ticket <key>` | `string` | *(Optional)* | Jira ticket key (e.g. `QA-101`, `SCRUM-42`) to fetch acceptance criteria. |
| `-u, --url <url>` | `string` | `demo/index.html` | Target application URL (supports `http://`, `https://`, and `file:///`). |
| `-m, --mock` | `boolean` | `false` | Force usage of `./fixtures/mock-ticket.json` instead of querying Jira REST API. |
| `-p, --post-to-jira` | `boolean` | `false` | Post execution verdict and repair logs as a markdown comment on the Jira issue. |
| `-r, --repeat <count>`| `number` | `1` | Number of test repetitions for detecting flaky tests (`N > 1`). |
| `--headless` | `boolean` | `true` | Run Chromium in headless mode. Pass `--no-headless` to watch execution live. |
| `-o, --output-dir <path>` | `string` | `reports` | Output directory for HTML dashboard, Markdown report, and JSONL repair log. |

### 1.3 Usage Examples

#### Run with Local Mock Ticket (Offline Safe):
```powershell
npm run agentic-mesh -- run --mock --url demo/index.html
```

#### Run on Mutated App (Showcase Self-Healing):
```powershell
npm run agentic-mesh -- run --mock --url demo/index.html?v=2
```

#### Run Against Live Jira Ticket with Closed-Loop Comment:
```powershell
npm run agentic-mesh -- run --ticket QA-101 --url demo/index.html --post-to-jira
```

#### Run Flaky Test Sweep (3 Iterations):
```powershell
npm run agentic-mesh -- run --mock --repeat 3
```

---

## 2. Programmatic TypeScript API

Agentic-mesh exports all core modules from `src/index.ts` for programmatic integration.

### 2.1 Runner Module (`src/runner/agenticMeshRunner.ts`)

#### `runSentinelSuite(options: SentinelRunOptions): Promise<SentinelRunResult>`
Executes an entire test suite against the target application.

```typescript
import { runSentinelSuite } from 'agentic-mesh';

const result = await runSentinelSuite({
  testCases: generatedTestCases,
  baseUrl: 'demo/index.html?v=2',
  headless: true,
  repeatCount: 1,
  outputDir: 'reports',
});

console.log(`Passed: ${result.passed}, Healed: ${result.healed}, Failed: ${result.failed}`);
```

**Parameters:**
- `options.testCases` (`TestCase[]`): Array of test cases to execute.
- `options.baseUrl` (`string`): Target web application URL.
- `options.headless` (`boolean`): Run browser headless (`true`) or headed (`false`).
- `options.repeatCount` (`number`): Number of test runs for flaky detection.
- `options.outputDir` (`string`): Directory where screenshots and reports are saved.

**Returns:** `Promise<SentinelRunResult>` containing aggregate metrics, test statuses, and individual step records.

---

### 2.2 Jira Client Module (`src/jira/jiraClient.ts`)

#### `fetchTicketCriteria(issueKey?: string, forceMock?: boolean): Promise<Ticket>`
Fetches issue details from Jira Cloud REST API. Automatically falls back to `./fixtures/mock-ticket.json` if credentials are not configured or network fails.

```typescript
import { fetchTicketCriteria } from 'agentic-mesh';

const ticket = await fetchTicketCriteria('QA-101');
console.log(ticket.key);               // "QA-101"
console.log(ticket.acceptanceCriteria); // ["User can log in with valid credentials", ...]
```

#### `postJiraResultComment(issueKey: string, summary: RunSummary): Promise<void>`
Formats the test execution outcome, repair details, and pass/fail counts into markdown and posts it as a comment to the specified Jira issue.

```typescript
import { postJiraResultComment } from 'agentic-mesh';

await postJiraResultComment('QA-101', {
  total: 4,
  passed: 4,
  failed: 0,
  healed: 2,
  repairs: repairRecords,
});
```

#### `adfToPlainText(node: any): string`
Recursively traverses an Atlassian Document Format (ADF) JSON tree and extracts clean plain text.

---

### 2.3 Test Generation Module (`src/generator/criteriaToSteps.ts`)

#### `criteriaToSteps(criteria: string[], baseUrl: string, ticketKey?: string): Promise<TestCase[]>`
Generates structured Playwright test cases from natural language acceptance criteria using Groq LLM (with Gemini and deterministic fallbacks).

```typescript
import { criteriaToSteps } from 'agentic-mesh';

const testCases = await criteriaToSteps(
  ['User enters valid username and password and logs in successfully'],
  'demo/index.html',
  'QA-101'
);
```

#### `deterministicCriteriaToSteps(criteria: string[], baseUrl: string, ticketKey?: string): TestCase[]`
Zero-dependency, offline rule-based heuristic test generator that parses criteria into standard Playwright actions.

---

### 2.4 Self-Healing & Similarity Module (`src/healing/similarity.ts`)

#### `computeSimilarity(target: TargetElement, candidate: ElementCandidate): SimilarityScoreResult`
Calculates the multi-attribute similarity matrix between a broken element selector and a live candidate element on the page.

```typescript
import { computeSimilarity } from 'agentic-mesh';

const score = computeSimilarity(
  { selector: '#login-btn', tag: 'button', text: 'Sign In', type: 'submit' },
  { selector: '#auth-submit-button', tag: 'button', text: 'Sign In', type: 'submit' }
);

console.log(score.totalScore); // 0.88 (High confidence match)
console.log(score.breakdown);  // { tag: 1.0, type: 1.0, text: 1.0, tokenOverlap: 0.6 }
```

#### `findBestHealingCandidate(target: TargetElement, candidates: ElementCandidate[]): CandidateMatch | null`
Ranks all live DOM candidate elements and returns the highest scoring candidate matching threshold criteria.

---

### 2.5 Repair Audit Logger (`src/healing/repairLog.ts`)

#### `recordRepair(record: RepairRecord): void`
Appends a repair record to `reports/repairs.jsonl` and emits a structured Pino log.

```typescript
import { recordRepair } from 'agentic-mesh';

recordRepair({
  testId: 'TC-1',
  stepIndex: 2,
  oldLocator: '#login-btn',
  newLocator: '#auth-submit-button',
  confidenceScore: 0.88,
  reason: 'Matched button tag, Sign In label, and submit type',
  resolvedBy: 'similarity_matrix',
  timestamp: new Date().toISOString(),
});
```

---

### 2.6 Report Builder Module (`src/report/reportBuilder.ts`)

#### `generateReport(result: SentinelRunResult, outputDir?: string): ReportPaths`
Compiles all test results and repair records into:
1. `reports/report.html`: Self-contained interactive dashboard with before/after visual diff viewer.
2. `reports/report.md`: GitHub-flavored markdown summary table.
3. Formatted CLI summary table printed directly to stdout.

---

## 3. Data Schemas (Zod)

All data structures are typed and validated at runtime using Zod in [`src/types.ts`](src/types.ts).

### 3.1 `TestCaseSchema`
```typescript
export const TestCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  steps: z.array(
    z.object({
      action: z.enum(['navigate', 'click', 'fill', 'assert_text', 'assert_visible', 'wait_for']),
      target: z.string(),           // CSS Selector or URL
      value: z.string().optional(),  // Value for fill actions or expected text
      description: z.string(),       // Human-readable step intent
      isVisual: z.boolean().optional(),
    })
  ),
});
```

### 3.2 `RepairRecordSchema`
```typescript
export const RepairRecordSchema = z.object({
  testId: z.string(),
  stepIndex: z.number(),
  oldLocator: z.string(),
  newLocator: z.string(),
  confidenceScore: z.number().min(0).max(1),
  reason: z.string(),
  resolvedBy: z.enum(['similarity_matrix', 'llm_groq', 'llm_gemini', 'manual']),
  timestamp: z.string(),
});
```

### 3.3 `repairs.jsonl` Entry Format
```json
{
  "testId": "TC-1",
  "stepIndex": 2,
  "oldLocator": "#login-btn",
  "newLocator": "#auth-submit-button",
  "confidenceScore": 0.88,
  "reason": "High similarity score (0.88): tag, text, and type match",
  "resolvedBy": "similarity_matrix",
  "timestamp": "2026-10-31T01:35:12.450Z"
}
```

