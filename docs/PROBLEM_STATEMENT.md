# Problem Statement: The Flaky Testing Nightmare

> **Innovista 36-Hour Hackathon — Problem Statement 08**  
> *Focus Area: Artificial Intelligence | Software Quality Engineering | DevOps Automation*

---

## 1. Industry Context & Background

Agile and DevOps transformations have dramatically accelerated modern software delivery. Engineering teams deploy code multiple times daily. To ensure production stability, organizations rely on end-to-end (E2E) browser automation suites (Playwright, Cypress, Selenium).

However, while development velocity has increased exponentially, **automated testing has become the single largest engineering bottleneck**.

```
+------------------+         +--------------------+         +-------------------+
|  Product Owner   |  ---->  | Software Engineer  |  ---->  |    QA Engineer    |
| Writes User Story|         | "Code Complete"    |         | Writes & Fixes    |
| & Acceptance Criteria       | Modifies UI / DOM  |         | Brittle UI Scripts|
+------------------+         +--------------------+         +-------------------+
                                                                     |
                                                                     v
                                                            [MAJOR BOTTLENECK]
                                                            Tests break daily
                                                            on superficial changes
```

---

## 2. The Core Problems

### 2.1 The Handoff Gap ("Code Complete" to "QA Tested")
When developers finish coding a feature defined by acceptance criteria in a Jira ticket, testing cannot commence until QA engineers manually:
1. Read and interpret the ticket criteria.
2. Inspect the newly built frontend DOM.
3. Write test cases step-by-step in automation frameworks.
4. Debug timing, selectors, and assertions.

This manual authoring process takes days per sprint, delaying feature releases and leaving code untested during critical rollout windows.

### 2.2 Fragile Locators & The Flaky Testing Nightmare
Traditional UI automation tests bind actions to rigid locators (CSS selectors, element IDs, or XPath strings):
```typescript
// Traditional Brittle Test Script
await page.locator('#btn-submit-order').click();
```

When frontend developers perform normal UI refactoring:
- An ID is changed: `#btn-submit-order` $\rightarrow$ `#order-checkout-button`
- CSS modules generate hashed class names: `.btn-primary` $\rightarrow$ `.Button_btn__a8f9x`
- A button label changes: `"Submit"` $\rightarrow$ `"Place Order"`
- An element wrapper is introduced: `<button>` wrapped inside `<div role="button">`

**The underlying business logic works perfectly, but the test suite fails immediately.** The team experiences **"The Flaky Testing Nightmare"**:
- Automated builds in CI/CD are blocked.
- Developers stop trusting test reports, assuming failures are "just flaky tests".
- QA engineers spend 30% to 50% of their weekly capacity manually inspecting DOM trees and updating locator strings.

---

## 3. The Hackathon Challenge

The Innovista PS 08 challenge asks:

> *"How might we create an autonomous testing system that connects to project management tools like Jira to instantly generate, run, and self-heal UI test scripts using only a ticket’s acceptance criteria?"*

### Primary Objectives:
1. **Zero-Touch Generation**: Eliminate the manual effort of writing UI tests by directly interpreting Jira acceptance criteria into executable test steps.
2. **Instant Execution**: Run tests against web applications the moment code is ready.
3. **Autonomous Self-Healing**: When an element changes (ID, label, attributes, or hierarchy), autonomously discover the new element on the live DOM, adapt the step, verify success, and continue the test run.
4. **Transparent Audit & Reporting**: Provide human-verifiable logs of every repair, ensuring full explainability and confidence.

---

## 4. Requirements & Compliance Matrix

| Requirement Tier | Specification Item | Hackathon Requirement | Agentic-mesh Implementation Status |
| :--- | :--- | :--- | :--- |
| **Mandatory** | **Ticket Input** | Read acceptance criteria from Jira REST API; fall back to `./fixtures/mock-ticket.json` if Jira is unavailable. | **100% Compliant** — Implemented via `jira.js` with ADF-to-text parser and automatic local mock fallback. |
| **Mandatory** | **Test Generation** | Automatically write UI tests from criteria. | **100% Compliant** — Implemented via Groq SDK (`openai/gpt-oss-120b`) with Gemini fallback and Zod schema enforcement. |
| **Mandatory** | **Test Execution** | Run against a demo web application; record pass/fail per test. | **100% Compliant** — Playwright-driven browser runner executing on local demo app with step-by-step verification. |
| **Mandatory** | **Self-Healing** | Find new element when ID/label/locator changes, fix the step automatically, and re-run. | **100% Compliant** — Healenium-inspired multi-attribute similarity matrix pre-filter + LLM arbitrator with instant replay. |
| **Mandatory** | **Reporting** | Show passed, failed, and auto-repaired tests. | **100% Compliant** — Multi-format reporting (HTML visual dashboard, Markdown summary, formatted CLI tables, and JSONL repair logs). |
| **Bonus** | **Jira Feedback** | Post execution verdicts and repair summaries back to the source Jira issue. | **100% Compliant** — Automatically writes formatted Markdown comments to Jira via REST API (`--post-to-jira`). |
| **Bonus** | **Visual Checks** | Compare screenshots before and after a change. | **100% Compliant** — Captures baseline visual state and failure state; renders visual diff in HTML report. |
| **Bonus** | **Flaky Detection** | Identify tests that pass and fail inconsistently across repeated runs. | **100% Compliant** — Multi-iteration sweep runner (`--repeat N`) tracks test consistency and flags flaky behaviors. |
| **Rule** | **Safe Targets** | Test only safe targets (own demo app or public demo sites). | **100% Compliant** — Custom demo app (`demo/index.html`) with dual-mode (`v1` baseline and `v2` refactor) and public demo support. |
| **Rule** | **Audit Log** | Log every repair: what changed and why. | **100% Compliant** — Immutable structured JSONL audit trail in `reports/repairs.jsonl` with similarity score, reason, and resolver. |
| **Rule** | **No Hardcoded Keys**| Never hardcode credentials or API keys. | **100% Compliant** — Strict environment variable management via `.env` and shielded by `.gitignore`. |

---

## 5. Summary

Agentic-mesh transforms the reactive, high-friction QA cycle into an autonomous, self-sustaining feedback loop. By bridging Jira tickets to live Playwright execution and backing it with an explainable, multi-attribute self-healing engine, Agentic-mesh eliminates the maintenance nightmare and restores developer confidence in test automation.

