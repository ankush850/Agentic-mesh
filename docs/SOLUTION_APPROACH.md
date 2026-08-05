# Solution Approach & Methodology

> **Engineering Design, Algorithmic Foundations, and Autonomous Pipeline of Agentic-mesh**

---

## 1. Architectural Philosophy

Traditional automated testing treats test scripts as static code that must be manually modified whenever application code changes. Agentic-mesh shifts this paradigm: **tests are dynamic behavioral specifications that continuously adapt to the evolving user interface.**

Our architectural approach is built on four core principles:

1. **Deterministic Specification**: Natural language acceptance criteria are converted into strictly validated, schema-typed action steps via Zod schemas.
2. **Dual-Tier Self-Healing**: Fast, zero-cost mathematical similarity scoring handles 90%+ of common locator drifts in milliseconds; high-reasoning LLMs are reserved for complex semantic changes.
3. **Full Explainability**: AI decisions must never be a black box. Every repair is accompanied by a mathematical similarity score, rationale, old vs. new selector diffs, and visual proof.
4. **Resilient Closed Loop**: From ticket ingestion to Jira comment write-back, the entire workflow operates autonomously without human intervention.

---

## 2. The 6-Stage Autonomous Pipeline

The Agentic-mesh workflow proceeds through six distinct stages:

```
+-----------------------------------------------------------------------------------+
|                            AGENTIC-MESH PIPELINE                                     |
+-----------------------------------------------------------------------------------+
  [Stage 1: Ingestion]
         │  Fetch Jira Issue via REST API (ADF -> Plaintext) or Fallback to Mock
         ▼
  [Stage 2: Synthesis]
         │  LLM Test Generator (Groq Llama 3.3/GPT-OSS 120B) + Zod Schema Validation
         ▼
  [Stage 3: Execution]
         │  Playwright Browser Runner executes actions sequentially
         ▼
  [Stage 4: Failure Detection]
         │  Selector lookup timeout (Playwright locator failure / DOM change)
         ▼
  [Stage 5: Dual-Tier Self-Healing]
         ├── Tier 1: Multi-Attribute Similarity Matrix (Tag, Text, Type, Attributes)
         └── Tier 2: LLM Arbiter (Top candidates submitted to Groq/Gemini)
         │  Update step, execute action, append repair audit to JSONL
         ▼
  [Stage 6: Multi-Format Reporting & Feedback]
            Generate HTML Dashboard, Markdown Summary, CLI Tables, & Post to Jira
```

---

## 3. Detailed Stage Methodologies

### 3.1 Stage 1: Ticket Ingestion & Criteria Parsing
- **Jira Cloud API Client**: Connects via `jira.js` (`Version3Client`) with Basic Auth (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`).
- **Atlassian Document Format (ADF) Parser**: Jira Cloud descriptions are stored in a nested JSON structure (ADF). Agentic-mesh's `adfToPlainText()` recursively traverses paragraphs, bullet lists, ordered lists, and code blocks to produce clean plain text.
- **Criteria Extraction Engine**: Regex-driven heuristic extracts bulleted or numbered requirements (`1.`, `-`, `*`, `Acceptance Criteria:`, `Given/When/Then`).
- **Graceful Mock Fallback**: If Jira credentials are not configured or the network is offline, the system seamlessly loads `fixtures/mock-ticket.json` without failing.

### 3.2 Stage 2: AI-Powered Test Synthesis
- **Prompt Engineering**: The acceptance criteria, ticket key, and target base URL are packaged into a structured prompt instructing the model to generate atomic Playwright actions:
  - `click`, `fill`, `navigate`, `assert_text`, `assert_visible`, `wait_for`.
- **Primary LLM**: Groq SDK using fast Llama 3.3 / GPT-OSS 120B models, producing full test suites in under 3 seconds.
- **Schema Validation**: Every LLM response is parsed and validated against `TestCaseSchema` (Zod). If the model emits invalid JSON or incorrect types, the system performs an automated retry with an error hint.
- **Secondary Multimodal Fallback**: If Groq is unavailable, the system fails over to Google Gemini (`@google/genai`).
- **Deterministic Heuristic Generator**: If LLM services are offline, a local rule-based generator parses login, logout, and CRUD patterns, guaranteeing offline availability.

### 3.3 Stage 3: Playwright Execution Engine
- Controls headless or headed Chromium instances.
- Supports both web URLs (`http://`, `https://`) and offline sandboxed local files (`file:///`).
- Before executing each step, the runner captures pre-action state. If a failure occurs, it takes a failure screenshot to support visual comparison.

### 3.4 Stage 4 & 5: The Dual-Tier Self-Healing Engine

When a test step fails because an element selector no longer exists on the page, Agentic-mesh activates its healing engine.

#### Why Pure LLM Healing is Flawed:
Calling an LLM for every single broken selector across an entire test suite introduces:
- **High Latency**: 2 to 5 seconds per failed step.
- **Excessive Token Costs**: Sending the entire DOM tree repeatedly.
- **Hallucination Risk**: Selecting non-interactive or invisible elements.

#### Why Agentic-mesh's Dual-Tier Approach Wins:
Agentic-mesh combines the deterministic speed of mathematical similarity scoring with the semantic power of LLMs.

```
                    [Step Fails: Selector Not Found]
                                   │
                                   ▼
                   Extract Live DOM Candidates from Page
               (Interactive tags: button, input, a, select...)
                                   │
                                   ▼
        [TIER 1: Multi-Attribute Similarity Matrix Pre-Filter]
        Calculates score based on Tag, Input Type, Text, Attributes
                                   │
                ┌──────────────────┴──────────────────┐
                │                                     │
        Score >= 0.75?                         Score < 0.75?
      (Clear single match)                (Ambiguous or multi-candidate)
                │                                     │
                ▼                                     ▼
        Auto-Accept Best Match            [TIER 2: LLM Arbiter]
                │                         Top 5 candidates + step intent
                │                         sent to Groq / Gemini
                │                                     │
                └──────────────────┬──────────────────┘
                                   ▼
                     Re-execute Step with New Locator
                                   │
                      Pass? ──► Update Step & Log Repair
```

#### The Similarity Scoring Formula:
The similarity score $S$ between the original target element $O$ and candidate element $C$ is computed as:

$$S(O, C) = 0.25 \cdot T_{\text{tag}} + 0.20 \cdot T_{\text{type}} + 0.25 \cdot S_{\text{text}} + 0.30 \cdot J_{\text{attr}}$$

1. **Tag Match ($T_{\text{tag}}$)**:
   - $1.0$ if HTML tags match exactly (e.g. `button` to `button`, `input` to `input`).
   - $0.0$ if tags differ.
2. **Type Match & Penalty ($T_{\text{type}}$)**:
   - For `input` elements: $1.0$ if input types match (`text` to `text`, `password` to `password`).
   - Strong penalty ($0.0$) if an input type changes (e.g. `password` $\rightarrow$ `checkbox`).
3. **Text & Label Similarity ($S_{\text{text}}$)**:
   - Normalized Levenshtein distance on inner text, aria-label, and placeholder strings:
     $$S_{\text{text}} = 1.0 - \frac{\text{Levenshtein}(text_O, text_C)}{\max(|text_O|, |text_C|)}$$
4. **Attribute Token Overlap ($J_{\text{attr}}$)**:
   - Jaccard similarity index across tokens extracted from `id`, `name`, `class`, `placeholder`, and `aria-label`:
     $$J_{\text{attr}} = \frac{|Tokens_O \cap Tokens_C|}{|Tokens_O \cup Tokens_C|}$$
   - Augmented with domain synonym matching (`username` $\approx$ `user-account-input`, `submit` $\approx$ `sign-in-btn`).

### 3.5 Stage 6: Reporting, Verification, and Jira Closed Loop
- **Immutable JSONL Audit**: Appends every repair to `reports/repairs.jsonl` with timestamp, old selector, new selector, element attributes, similarity score, reason, and resolver model.
- **Autonomous Bug Reporter**: When a test step experiences a permanent failure (e.g. real application bug that self-healing cannot resolve) and `--auto-bug` is enabled, Agentic-mesh automatically generates a professional BDD bug description via Groq, files a Jira Bug issue, and attaches the failure screenshot to the issue.
- **Interactive HTML Dashboard**: Builds a self-contained HTML report with KPI counters, test duration, status badges, an interactive visual diff modal, and an audit table.
- **Markdown & CLI Summaries**: Generates GitHub-flavored `reports/report.md` and formatted terminal summary tables.
- **Flaky Detection Engine**: With `--repeat N`, Agentic-mesh runs $N$ test sweeps. Tests that yield mixed results (some pass, some fail) are flagged as `FLAKY`.
- **Jira Feedback**: When invoked with `--post-to-jira`, formats the run summary and repair details into a structured comment posted directly to the source Jira issue.

