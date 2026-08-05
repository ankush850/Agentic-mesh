# System Architecture

> **Component Architecture, Interaction Sequences, State Machines, and Data Flow in Agentic-mesh**

---

## 1. High-Level Component Architecture

Agentic-mesh is organized into six decoupled, modular subsystems. Each subsystem has a single responsibility, cleanly defined interfaces, and comprehensive test coverage.

```mermaid
flowchart TD
    subgraph CLI_Entry ["1. Entry & CLI Layer"]
        CLI["src/cli.ts (Commander CLI)"]
        DemoRunner["src/demo-runner.ts (Showcase Runner)"]
        Index["src/index.ts (Public Library API)"]
    end

    subgraph Ingestion ["2. Ticket Ingestion Subsystem"]
        JiraClient["src/jira/jiraClient.ts"]
        ADF["ADF Parser (adfToPlainText)"]
        MockFixture["fixtures/mock-ticket.json"]
    end

    subgraph LLM_Subsystem ["3. LLM & Synthesis Subsystem"]
        Provider["src/llm/provider.ts"]
        Generator["src/generator/criteriaToSteps.ts"]
        ZodSchemas["src/types.ts (Zod Validation)"]
        Groq["Groq SDK (Primary)"]
        Gemini["Google Gemini (Fallback)"]
    end

    subgraph Runner_Engine ["4. Playwright Execution Subsystem"]
        Runner["src/runner/agenticMeshRunner.ts"]
        Playwright["Playwright Chromium Browser"]
        VisualCapture["Visual State / Screenshot Capture"]
    end

    subgraph Healing_Engine ["5. Dual-Tier Self-Healing Subsystem"]
        Similarity["src/healing/similarity.ts (Healenium Matrix)"]
        LLMArbiter["LLM Element Selector"]
        RepairLog["src/healing/repairLog.ts (Pino & JSONL)"]
    end

    subgraph Reporting_Subsystem ["6. Audit & Reporting Subsystem"]
        ReportBuilder["src/report/reportBuilder.ts"]
        HTMLReport["reports/report.html (Interactive Dashboard)"]
        MDReport["reports/report.md (Markdown Summary)"]
        JSONLRepairs["reports/repairs.jsonl (Audit Trail)"]
    end

    CLI --> JiraClient
    CLI --> Generator
    CLI --> Runner
    CLI --> ReportBuilder

    JiraClient --> ADF
    JiraClient -. Offline Fallback .-> MockFixture

    Generator --> Provider
    Provider --> Groq
    Groq -. Fallback .-> Gemini
    Generator --> ZodSchemas

    Runner --> Playwright
    Runner --> VisualCapture
    Runner --> Similarity
    Similarity -. Low Confidence .-> LLMArbiter
    LLMArbiter --> Provider
    Similarity --> RepairLog

    ReportBuilder --> HTMLReport
    ReportBuilder --> MDReport
    RepairLog --> JSONLRepairs
    ReportBuilder -. Bonus .-> JiraClient
```

---

## 2. End-to-End Sequence Diagram

The following sequence diagram illustrates the lifecycle of a test execution, from Jira criteria retrieval to self-healing and Jira comment write-back.

```mermaid
sequenceDiagram
    autonumber
    actor User as User / CI Pipeline
    participant CLI as CLI / AgenticMeshRunner
    participant Jira as Jira REST API
    participant LLM as LLM Provider (Groq/Gemini)
    participant Browser as Playwright Browser
    participant Healing as Similarity & Healing Engine
    participant Audit as Report Builder & Logger

    User->>CLI: agentic-mesh run --ticket QA-101 --post-to-jira
    CLI->>Jira: fetchTicketCriteria("QA-101")
    alt Jira Available
        Jira-->>CLI: Issue JSON (ADF format)
        CLI->>CLI: adfToPlainText() -> Acceptance Criteria[]
    else Jira Unreachable
        CLI->>CLI: Load fixtures/mock-ticket.json
    end

    CLI->>LLM: criteriaToSteps(criteria, baseUrl)
    LLM-->>CLI: TestCase[] (Validated against TestCaseSchema)

    loop For Each TestCase
        loop For Each TestStep
            CLI->>Browser: Execute Action (click / fill / assert)
            alt Element Found & Action Succeeds
                Browser-->>CLI: Success
            else Element Missing / Timeout (Locator Drift)
                Browser-->>CLI: Error: Target element not found
                CLI->>Browser: Capture Failure Screenshot
                CLI->>Browser: Extract Live Interactive DOM Elements
                Browser-->>CLI: ElementCandidate[]
                CLI->>Healing: findBestHealingCandidate(oldLocator, candidates)
                Healing->>Healing: Compute Tag, Type, Text, Token Matrix
                alt Score >= 0.75 (High Confidence)
                    Healing-->>CLI: Best Candidate (Score, Reason)
                else Score < 0.75 (Ambiguous)
                    Healing->>LLM: Pick best candidate from top 5
                    LLM-->>Healing: Selected Candidate
                    Healing-->>CLI: Candidate (Model Decision)
                end
                CLI->>Browser: Retry Step with Repaired Locator
                Browser-->>CLI: Action Success!
                CLI->>Audit: recordRepair(oldLocator, newLocator, score, reason)
            end
        end
    end

    CLI->>Audit: generateReport(runResult)
    Audit-->>User: HTML Dashboard & CLI Summary Table
    opt --post-to-jira enabled
        CLI->>Jira: postJiraResultComment("QA-101", runSummary)
        Jira-->>CLI: Comment Posted (201 Created)
    end
```

---

## 3. Self-Healing State Machine

The self-healing subsystem governs how test steps transition between operational states:

```mermaid
stateDiagram-v2
    [*] --> StepStarted
    StepStarted --> ActionExecuting: Execute Playwright Step

    ActionExecuting --> StepPassed: Element Found & Verified
    ActionExecuting --> HealingTriggered: Timeout / Element Missing

    HealingTriggered --> LiveDomExtraction: Capture Failure Screenshot
    LiveDomExtraction --> SimilarityFiltering: Scan Live Interactive Elements

    SimilarityFiltering --> AutoResolved: Similarity Score >= 0.75
    SimilarityFiltering --> LLMArbiter: Score < 0.75 (Ambiguous)

    LLMArbiter --> AutoResolved: LLM Selects Candidate
    LLMArbiter --> StepFailed: No Viable Match Found

    AutoResolved --> ReplayingStep: Substitute New Locator
    ReplayingStep --> StepHealed: Replay Succeeds & Verified
    ReplayingStep --> StepFailed: Replay Fails

    StepPassed --> [*]
    StepHealed --> LogRepair: Append to reports/repairs.jsonl
    LogRepair --> [*]
    StepFailed --> [*]
```

---

## 4. Subsystem & Module Responsibilities

### 4.1 CLI & Entry Layer
- [`src/cli.ts`](src/cli.ts): Commander.js CLI defining flags (`--ticket`, `--url`, `--mock`, `--post-to-jira`, `--repeat`, `--headless`, `--output-dir`).
- [`src/demo-runner.ts`](src/demo-runner.ts): 6-phase automated comparison script showcasing `v1` baseline vs `v2` refactor self-healing.
- [`src/index.ts`](src/index.ts): Central re-export of all core and legacy engine modules.

### 4.2 Ticket Ingestion Layer
- [`src/jira/jiraClient.ts`](src/jira/jiraClient.ts):
  - `fetchTicketCriteria()`: Queries Jira REST API via `jira.js` with ADF parsing.
  - `adfToPlainText()`: Recursively extracts text from nested Atlassian Document Format nodes.
  - `extractCriteria()`: Heuristic extractor for bulleted and numbered acceptance criteria.
  - `postJiraResultComment()`: Submits markdown-formatted execution results as Jira issue comments.
- [`fixtures/mock-ticket.json`](fixtures/mock-ticket.json): Offline fallback ticket with 4 realistic acceptance criteria (Login Success, Login Failure, Add Task, Logout).

### 4.3 LLM Orchestration Layer
- [`src/llm/provider.ts`](src/llm/provider.ts):
  - Primary provider: Groq SDK (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`).
  - Secondary fallback: Dynamic import of Google Gemini (`@google/genai`).
  - Robust JSON parser with markdown fence stripping and schema retry logic.
- [`src/generator/criteriaToSteps.ts`](src/generator/criteriaToSteps.ts):
  - `criteriaToSteps()`: Maps criteria to structured `TestCase[]` with atomic Playwright actions.
  - `deterministicCriteriaToSteps()`: Offline rule-based fallback when no LLM API is available.
- [`src/types.ts`](src/types.ts): Zod schemas (`TicketSchema`, `TestCaseSchema`, `RepairRecordSchema`, `TestResultSchema`, `ElementCandidate`).

### 4.4 Execution & Healing Layer
- [`src/runner/agenticMeshRunner.ts`](src/runner/agenticMeshRunner.ts):
  - Playwright browser lifecycle manager.
  - In-browser candidate extraction via `page.evaluate()`.
  - Visual screenshot capture (baseline and failure states).
  - Flaky test detection multi-run loop.
- [`src/healing/similarity.ts`](src/healing/similarity.ts):
  - `computeSimilarity()`: Multi-attribute scoring matrix (Tag, Type, Text, Token Overlap).
  - `findBestHealingCandidate()`: Ranks live DOM candidates and returns top candidates.
- [`src/healing/repairLog.ts`](src/healing/repairLog.ts):
  - Appends structured records to `reports/repairs.jsonl`.
  - Emits formatted Pino logs.

### 4.5 Reporting Layer
- [`src/report/reportBuilder.ts`](src/report/reportBuilder.ts):
  - Generates self-contained HTML dashboard with embedded CSS/JS (`reports/report.html`).
  - Generates GitHub-flavored Markdown summary (`reports/report.md`).
  - Renders colored CLI summary tables via console.

---

## 5. Data Flow & Artifact Persistence

```
[Inputs]
  ├── Jira REST API / mock-ticket.json
  └── CLI flags (--ticket, --url, --repeat)
       │
[Runtime Memory State]
  ├── Ticket { key, title, criteria[] }
  ├── TestCase[] { id, name, steps[] }
  └── ElementCandidate[] { selector, tag, text, attributes }
       │
[Output Artifacts]
  ├── reports/report.html      <- Interactive visual dashboard with diff modal
  ├── reports/report.md        <- Markdown summary table
  ├── reports/repairs.jsonl    <- Immutable append-only repair audit trail
  └── reports/screenshots/     <- Failure and before/after screenshot comparisons
```

