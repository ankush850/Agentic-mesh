# Project Overview: Agentic-mesh

> **Autonomous End-to-End Test Synthesis, Resilient Execution, and Self-Healing Engine**  
> *Developed for Innovista 36-Hour Hackathon — Problem Statement 08: "The Flaky Testing Nightmare"*

---

## 1. Executive Summary

In fast-paced Agile engineering organizations, the handoff between **"Code Complete"** and **"QA Tested"** is the primary bottleneck delaying production releases. Developers alter element IDs, refactor class names, update CSS frameworks, or modify button text to satisfy changing UI/UX requirements. In response, brittle UI automation suites fail catastrophically—not because business logic broke, but because rigid CSS and XPath locators could no longer resolve elements on the page.

**Agentic-mesh** solves this dilemma by introducing a zero-touch, closed-loop testing system that:
1. **Ingests** acceptance criteria directly from Jira user stories via REST API (with offline mock fallback).
2. **Synthesizes** deterministic, multi-step Playwright UI test specifications using high-speed LLMs structured with Zod validation.
3. **Executes** tests against web applications in real browser sessions.
4. **Self-Heals** broken selectors in real time using a dual-tier healing engine (Healenium-inspired multi-attribute similarity matrix pre-filter + LLM arbitrator).
5. **Audits & Reports** all test verdicts, flaky anomalies, and detailed repair diffs across HTML dashboards, Markdown summaries, CLI output, and writes back status comments directly to Jira.

---

## 2. Mission Statement

> *"To eliminate manual UI test maintenance and bridge the gap between feature specification and automated verification, allowing engineering teams to ship reliable software at the speed of thought."*

---

## 3. Core Capabilities at a Glance

| Feature | Description | Primary Engine / Module |
| :--- | :--- | :--- |
| **Ticket Ingestion** | Fetches Jira issues, parses Atlassian Document Format (ADF) into clean criteria, with automatic offline fallback. | [`src/jira/jiraClient.ts`](src/jira/jiraClient.ts) (`jira.js`) |
| **Test Synthesis** | Converts natural-language acceptance criteria into structured Playwright test actions with strict Zod validation. | [`src/generator/criteriaToSteps.ts`](src/generator/criteriaToSteps.ts) (`groq-sdk`) |
| **Playwright Runner** | Controls Chromium instances, executes test sequences, and captures before/after visual state snapshots. | [`src/runner/agenticMeshRunner.ts`](src/runner/agenticMeshRunner.ts) (`playwright`) |
| **Dual-Tier Self-Healing** | Calculates multi-attribute similarity across candidate elements; escalates ambiguous candidates to Groq/Gemini. | [`src/healing/similarity.ts`](src/healing/similarity.ts) |
| **Immutable Repair Audit** | Records exact old vs. new locators, element tag/text, confidence score, and timestamp to a permanent JSONL log. | [`src/healing/repairLog.ts`](src/healing/repairLog.ts) (`reports/repairs.jsonl`) |
| **Multi-Format Reporting** | Produces interactive HTML dashboards with before/after visual diffs, Markdown reports, and rich CLI terminal tables. | [`src/report/reportBuilder.ts`](src/report/reportBuilder.ts) |
| **Flaky Test Sweeper** | Executes repeated test cycles (`--repeat N`) to detect intermittent timing or locator instability. | [`src/runner/agenticMeshRunner.ts`](src/runner/agenticMeshRunner.ts) |
| **Jira Closed-Loop Feedback** | Automatically formats execution results, pass rates, and repair logs into a comment on the source Jira issue. | [`src/jira/jiraClient.ts`](src/jira/jiraClient.ts) |

---

## 4. Stakeholder Value Proposition

### 🛡️ For QA Engineers
- **Zero Locator Maintenance**: No more waking up to failing test suites caused by a renamed `id` or CSS class change.
- **Explainable Repairs**: Every single locator repair is logged with a mathematical similarity score, reasoning, and visual proof.
- **Fast Test Authoring**: Instant translation from Jira acceptance criteria to executable Playwright suites.

### ⚡ For Developers
- **Immediate Pre-Merge Feedback**: Run Agentic-mesh locally or in CI/CD against PR branch builds before pushing to staging.
- **No Test Code Friction**: Refactor front-end layouts and component hierarchies without worrying about breaking fragile QA scripts.

### 📈 For Product Owners & Engineering Leaders
- **True Acceptance Verification**: Direct traceability from Jira user story acceptance criteria to automated test verdict.
- **Shorter Sprint Cycles**: Accelerates the transition from "In Review" to "Done" from days to minutes.
- **Reduced Flakiness & Churn**: Automated detection of non-deterministic tests builds team confidence in CI pipelines.

---

## 5. Hackathon Problem Statement 08 Alignment

Agentic-mesh achieves **100% compliance** with all mandatory and bonus requirements established in Hackathon PS 08 (*"The Flaky Testing Nightmare"*):

```
[MANDATORY REQUIREMENTS]
✅ Ticket Input: Reads acceptance criteria from Jira REST API (with ./fixtures/mock-ticket.json fallback).
✅ Test Generation: Automatically writes UI test suites from criteria using LLMs & Zod validation.
✅ Test Execution: Executes tests against demo web application and records pass/fail per step.
✅ Self-Healing: Detects broken locators, scans live DOM candidates, repairs the step, and completes the run.
✅ Multi-format Reporting: Outputs HTML dashboard, Markdown summary, and formatted CLI tables.

[BONUS REQUIREMENTS]
✅ Jira Ticket Update: Automatically posts comprehensive test verdicts and repair tables back to Jira.
✅ Visual Comparison: Captures before and after failure screenshots and provides an interactive visual diff viewer.
✅ Flaky Test Detection: Multi-iteration sweep flag (--repeat N) flags intermittently failing or timing-sensitive tests.

[CORE RULES]
✅ Safe Targets: Tests local demo app (demo/index.html with ?v=2 mutation) and sanctioned public sites.
✅ Log Every Repair: Every locator substitution is recorded in reports/repairs.jsonl.
✅ Credential Protection: Zero hardcoded secrets; 100% managed through .env and .gitignore.
```

---

## 6. Project Navigation

- [Problem Statement Analysis](docs/PROBLEM_STATEMENT.md)
- [Solution Approach & Methodology](docs/SOLUTION_APPROACH.md)
- [System Architecture & Data Flow](docs/SYSTEM_ARCHITECTURE.md)
- [Technology Stack Breakdown](docs/TECH_STACK.md)
- [API & CLI Documentation](docs/API_DOCUMENTATION.md)
- [Setup & Execution Guide](docs/SETUP_GUIDE.md)
- [Future Scope & Production Roadmap](docs/FUTURE_SCOPE.md)

