# Technology Stack & Dependencies

> **Comprehensive Rationale, Version Specifications, and Architectural Evaluation of Agentic-mesh Technologies**

---

## 1. Stack Overview

Agentic-mesh combines high-performance LLM inference engines, browser automation primitives, mathematical similarity heuristics, and enterprise issue-tracker integrations to deliver an autonomous testing platform.

```
+-----------------------------------------------------------------------------------+
|                               AGENTIC-MESH STACK                                    |
+-----------------------------------------------------------------------------------+
  [Language & Runtime]  TypeScript 5.x | Node.js 20+ LTS | CommonJS & Dynamic ESM
  [AI / LLMs]           Groq SDK (Primary LPU) | Google Gemini SDK (Secondary Multimodal)
  [Schema Validation]   Zod 3.x
  [Browser Engine]      Playwright (Chromium)
  [Unit Testing]        Vitest 4.x
  [Issue Management]    jira.js (Jira Cloud REST API v3)
  [Telemetry & Logs]    Pino 9.x | Pino-pretty | JSONL
  [CLI Framework]       Commander.js 12.x
  [Target Demo]         Vanilla HTML5 / ES6 (No external dependencies)
```

---

## 2. Component-by-Component Technology Analysis

### 2.1 Language & Execution Runtime
| Technology | Version / Spec | Role in Agentic-mesh | Justification |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>=20.0.0` (LTS) | Execution Runtime | Native support for modern ECMAScript, robust child processes, and native fetch. |
| **TypeScript** | `^5.4.0` | Primary Language | Static type safety across test schemas, Playwright actions, and AST/DOM structures. |
| **Module System** | CommonJS + Dynamic ESM | Module Resolution | Maintains compatibility with existing `qa-agent` core while allowing lazy dynamic `await import()` for ESM-only packages like `@google/genai`. |

### 2.2 Artificial Intelligence & LLMs
| Technology | Package | Model Used | Justification |
| :--- | :--- | :--- | :--- |
| **Groq SDK** | `groq-sdk` (`^0.15.0`) | `openai/gpt-oss-120b`<br>`llama-3.3-70b-versatile` | Ultra-fast token generation on Groq LPUs. Generates multi-step test cases in under 3 seconds at a fraction of OpenAI costs. |
| **Google GenAI** | `@google/genai` (`^0.1.1`) | `gemini-2.5-flash` | Secondary fallback provider and multimodal visual assertion engine for screenshot analysis. |
| **Zod** | `zod` (`^3.22.0`) | Schema Enforcement | Guarantees strict runtime validation on all LLM JSON outputs (`TestCaseSchema`, `RepairRecordSchema`). Eliminates hallucinations and runtime type exceptions. |

### 2.3 Browser Automation & Test Frameworks
| Technology | Package | Role in Agentic-mesh | Justification |
| :--- | :--- | :--- | :--- |
| **Playwright** | `playwright` (`^1.48.0`) | Browser Automation | Controls headless/headed Chromium, captures full-page DOM trees, evaluates client-side JavaScript, and records before/after failure screenshots. |
| **Vitest** | `vitest` (`^4.1.0`) | Unit & Integration Test Suite | Extremely fast test runner with TypeScript support out of the box. Runs 17 test suites (176 tests) in ~6.5 seconds. |

### 2.4 Issue Management & Jira Integration
| Technology | Package | Role in Agentic-mesh | Justification |
| :--- | :--- | :--- | :--- |
| **jira.js** | `jira.js` (`^3.2.0`) | Jira Cloud REST Client | Fully typed TypeScript client for Atlassian Jira Cloud REST API v3. Handles ticket fetching, description retrieval, and comment creation. |

### 2.5 Logging, Auditing & CLI
| Technology | Package | Role in Agentic-mesh | Justification |
| :--- | :--- | :--- | :--- |
| **Pino** | `pino` (`^9.4.0`) | High-Speed Structured Logging | Zero-overhead JSON logger; streams structured execution events. |
| **Pino Pretty** | `pino-pretty` (`^11.2.0`) | Console Log Formatting | Formats real-time terminal output during interactive test runs. |
| **Commander** | `commander` (`^12.1.0`) | CLI Parsing Engine | Powers the `agentic-mesh` command-line interface with options, flags, and help text. |
| **Dotenv** | `dotenv` (`^16.4.0`) | Environment Configuration | Safely injects API credentials and settings from `.env` without risk of committing secrets. |

---

## 3. Technology Evaluation & Alternatives Considered

| Decision Area | Selected Technology | Alternative Evaluated | Why the Selected Tech Won |
| :--- | :--- | :--- | :--- |
| **Primary LLM Engine** | **Groq (Llama / GPT-OSS)** | OpenAI GPT-4o / Claude 3.5 | Groq LPUs deliver 500+ tokens/sec, enabling test generation and healing decisions in <3 seconds instead of 10-15 seconds. |
| **Browser Runner** | **Playwright** | Selenium / Puppeteer | Playwright provides unified browser support, built-in retry mechanisms, deep DOM evaluation, and visual capture without external drivers. |
| **Self-Healing Approach** | **Dual-Tier (Healenium Matrix + LLM)** | Pure LLM Prompts | Pure LLM on every broken locator costs \$\$\$ and adds 5s latency per element. Mathematical similarity solves 90%+ in <10ms for free. |
| **Unit Test Runner** | **Vitest** | Jest | Vitest requires zero Babel configuration for TypeScript, shares Vite's fast HMR/transform pipeline, and runs 3x faster than Jest. |
| **Jira Client** | **jira.js** | Raw `fetch` / Axios | `jira.js` provides strict TypeScript definitions for Jira v3 REST API and Atlassian Document Format (ADF) models. |

---

## 4. Security & Compliance Architecture

1. **Zero Secret Leakage**:
   - `.env` is permanently excluded via `.gitignore`.
   - `.env.example` contains only sanitized placeholder keys.
   - All API keys are injected via `process.env` at runtime.
2. **Safe Target Restrictions**:
   - Testing is strictly constrained to local mock targets (`demo/index.html`) or explicitly supplied user URLs.
   - Destructive network operations or unauthorized domains are restricted.
3. **Immutable Audit Trails**:
   - Every self-healing action is logged to `reports/repairs.jsonl` with human-readable rationale, old and new selectors, and timestamps.

