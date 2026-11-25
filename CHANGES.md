# CHANGES — Agentic-mesh Web Console

This file lists **every** change made to add the Agentic-mesh web console (`web/`) and its API
layer (`server/`), as required by the "build the frontend without breaking the backend" brief.

**Prime directive — additive only.** The engine in `src/` keeps its behaviour, its public
types and its CLI. Only five existing files were touched, and each one is justified below.
Everything else lives in new directories.

The CLI (`npm run agentic-mesh`) and the showcase (`npm run demo`) behave exactly as they did
before this work.

---

## 1. Existing files that were modified

| File | Change | Why it could not be additive |
| :--- | :--- | :--- |
| `src/runner/agenticMeshRunner.ts` | New **optional** `hooks?: RunnerHooks` field on `RunnerOptions`, a `safeCall()` helper, a private `isCancelled()`, and twelve `safeCall(...)` call sites. No existing signature, default value or code path changed. | The console streams step/test progress over SSE, and the only place that knows when a step starts, fails, heals or ends is inside the runner. `hooks` defaults to `{}`, so every hook is `undefined` and `safeCall` returns immediately — the CLI and `npm run demo` traverse identical code. |
| `package.json` | Seven new scripts: `dev:api`, `dev:ui`, `build:ui`, `test:ui`, `typecheck:server`, `typecheck:ui`, `test:e2e`. | Scripts have to be registered in the root manifest. No existing script was edited. |
| `.env.example` | Appended a "Agentic-mesh Web API (`server/`)" block documenting `PORT`, `HOST`, `UI_MOCK`, `RUNS_DIR`, `ALLOWED_TARGETS`, `UI_HEADED`, `RATE_LIMIT_PER_MINUTE`. | The canonical example file has to mention the new server variables. Existing values untouched. |
| `.gitignore` | Added `web/dist/`, `runs/`, `.e2e-runs/`, `server/reports/`, `test-results/`, `playwright-report/`. | Generated build output and run artifacts must not be committed. |
| `README.md` | New "🖥️ Frontend — the Agentic-mesh Web Console" section (architecture mermaid, 3-command start, page table, API table, safety notes), a "Web API (`server/`)" env-var table, the new directories in the Project Structure tree, and a Credits section. | Documentation only. |

`git diff --stat` for tracked files after the change set:

```
 .env.example                 |  24 ++++++
 .gitignore                   |  11 ++-
 README.md                    | 185 ++++++++++++++++++++++++++++++++---
 package.json                 |   9 ++-
 src/runner/agenticMeshRunner.ts | 138 +++++++++++++++++++++++++++++++-
```

### Rollback

```bash
git checkout -- src/runner/agenticMeshRunner.ts package.json .env.example .gitignore README.md
rm -rf server web shared e2e playwright.config.ts
```

The repository is then byte-identical to its pre-console state and `npm run demo` still works.

---

## 2. New directories

| Path | Contents |
| :--- | :--- |
| `shared/contracts.ts` | The single source of truth for the API: zod schemas, inferred types, the `RunEventPayloads` map and the mapped `RunEvent` union, `serializeEvent()`, plus compile-time drift guards that fail `tsc` if a schema stops matching an engine type. Engine types are imported **type-only**, so nothing new enters the engine's runtime graph. |
| `server/` | Fastify 5 API in front of the engine (`npm run dev:api`). |
| `web/` | React 19 + Vite 7 + Tailwind v4 single-page console (`npm run dev:ui`). |
| `e2e/agentic-mesh-console.spec.ts` | One Playwright end-to-end test. |
| `playwright.config.ts` | Boots the API **and** the console itself in `UI_MOCK` mode. |
| `src/__tests__/server-api.test.ts` | API integration tests added to the existing root suite (the only new file inside `src/`, and it is a test). |

### Server layout (`server/src/`)

| File | Responsibility |
| :--- | :--- |
| `index.ts` | Entrypoint; loads `<repo>/.env`, starts Fastify. |
| `app.ts` | Plugin registration, CORS, rate limit, health, error envelope. |
| `env.ts` | Typed, defaulted environment reading. |
| `orchestrator.ts` | Serial run queue, cancel tokens, runner hook wiring, persistence. |
| `events.ts` | In-process event bus + `events.ndjson` append/replay. |
| `store.ts` | `runs/<runId>/run.json`, `repairs.jsonl` and artifact readers/writers. |
| `security.ts` | `ALLOWED_TARGETS` allowlist, artifact path guard, `TargetNotAllowedError` / `PathTraversalError`. |
| `settings.ts` | Persisted console settings. |
| `routes/health.ts` · `intake.ts` · `runs.ts` · `repairs.ts` · `admin.ts` | The 18 routes required by the brief. |
| `mock/fixtures.ts`, `mock/play.ts` | Deterministic fixtures and timed playback for `UI_MOCK=1`. |

`server/tsconfig.json` and `server/package.json` stay local, so the root `tsconfig.json`
project is unchanged.

---

## 3. Contract additions

Two **additive** fields were needed to render the Live Run page; both live in the new
`shared/contracts.ts`, so no engine type changed:

| Field | Why |
| :--- | :--- |
| `RunDetail.plannedTests` | A run is created with a test plan but no results yet. Live Run has to list the tests before the first `test.finished` arrives, otherwise the page is blank for the first seconds of every run. |
| `Settings.demoAppVersion` | Demo Controls must show which version of the bundled app the server is currently serving. |

---

## 4. Engine hook surface

`RunnerHooks` is shaped so that every field is optional and observation-only:

| Hook | Fired |
| :--- | :--- |
| `onRunStart` · `onRunEnd` | Around `runTests()`. |
| `onTestStart` · `onTestEnd` | Around each test (all repeats). |
| `onStepStart` · `onStepEnd` | Around each step, carrying `durationMs` and `repaired`. |
| `onReasoning` | When a locator is resolved and again with the candidate action. |
| `onStepHealing` | The moment the primary locator fails and healing begins (drives the banner). |
| `onStepHealed` | After a repair record is built, carrying old/new locator, model, confidence. |
| `onStepFailed` | A step threw. |
| `isCancelled` | Polled between tests and between steps; returning `true` aborts the run with "Run cancelled by user". |

Every invocation goes through `safeCall`, which swallows hook exceptions, so a bug in the API
layer can never turn a passing test into a failing one.

---

## 5. API behaviour notes

- **SSE**: envelope `{ id, runId, ts, type, data }`, one JSON line per frame, `id:` line for
  `Last-Event-ID` replay. Twelve event types: `run.started`, `test.started`, `step.started`,
  `step.reasoning`, `step.passed`, `step.healing`, `step.healed`, `step.failed`,
  `test.finished`, `run.finished`, `run.error`, `llm.fallback`. Every event is appended to
  `runs/<runId>/events.ndjson`, so a reconnect replays instead of losing history.
- **Queue**: runs are serialised one at a time; a queued or active run can be cancelled.
- **Screenshot payloads**: `onStepHealed` receives base64 screenshots, but the orchestrator
  writes them to `runs/<runId>/screenshots/` (`persistRepairScreenshots`) before emitting, so
  SSE frames stay small and the console links to `/api/runs/:id/artifacts/...`.
- **Errors**: always `{ error: { code, message } }`. `ApiError` → its status,
  `TargetNotAllowedError` → 403 `target_not_allowed`, `PathTraversalError` → 400, anything
  else → 500 `internal_error` (the underlying message is not leaked).
- **Secrets**: `GROQ_API_KEY`, `GEMINI_API_KEY` and the Jira credentials are read from the
  server environment only. `/api/health` and `/api/settings` report provider *status* and
  model *names*, never keys.
- **Jira write path**: `POST /api/jira/post-result` defaults to `dryRun: true`; posting must be
  requested explicitly.
- **`UI_MOCK=1`**: deterministic fixtures and timed playback, no LLM calls, no Jira, no browser
  download. This is the mode used by the e2e suite and the demo steps in the README.

---

## 6. Console behaviour notes

- Stack: React 19, Vite 7, Tailwind v4, TanStack Query 5, zustand 5, zod 4, lucide-react,
  recharts, framer-motion, `diff`. Route-level lazy loading keeps the initial bundle small.
- Every response is parsed with the shared zod schema on the client too, so contract drift
  fails loudly instead of rendering garbage.
- Status is always colour **and** icon **and** text (passed = green, failed = red, healed =
  amber, flaky = violet); dark is the default theme with a light toggle.
- Loading, empty and error states exist for every panel; toasts confirm mutations; all
  interactive elements are real buttons/links with visible focus rings (keyboard navigable).
- `MSW` handlers let the console run fully offline against fixtures (`web/src/mocks/`).

---

## 7. Defects found and fixed during verification

All six were found by the new tests and all fixes are inside **new** code — no engine change
was required:

1. **Mock playback replayed every step as `pending`** — `play.ts` reset the scripted status to
   `pending` and then read `step.status` back, so `step.healed` / `step.failed` never fired and
   the healing banner never appeared in mock mode. Fixed by capturing `intendedByStep` before
   the reset.
2. **`run.finished` emitted with a still-`running` summary** — the console froze on "Running"
   and closed the stream. The orchestrator now owns the terminal event; playback no longer
   emits one.
3. **`useRunEvents` closed the EventSource on any `run.finished`** — now it only closes when the
   summary status is terminal (`isTerminalRunStatus`), which also makes polling fallback safe.
4. **`RepairRow` nested a `<Link>` inside a `<button>`** (invalid HTML) — the anchor swallowed
   the row click and sent the user to the run report instead of expanding the diff. The link
   now sits outside the toggle, in its own column.
5. **`artifactUrl("screenshots/a.png")` produced `/apiscreenshots/a.png`** — missing separator
   and backslash handling. Now normalises leading separators and `\` → `/`.
6. **`TargetNotAllowedError` returned 500** instead of 403 because `sendError` only understood
   `ApiError`. Allowlist rejections now map to 403 and path-traversal rejections to 400.

---

## 8. Tests added

| Suite | File | Tests |
| :--- | :--- | :--- |
| API integration | `src/__tests__/server-api.test.ts` | 14 |
| Console unit | `web/src/lib/status.test.ts` | 7 |
| Console unit | `web/src/lib/liveModel.test.ts` | 9 |
| Console unit | `web/src/lib/api.test.ts` | 8 |
| Console component | `web/src/components/StatusBadge.test.tsx` | 3 |
| Console component | `web/src/components/LocatorDiff.test.tsx` | 3 |
| Console component | `web/src/components/StepTimeline.test.tsx` | 7 |
| End-to-end | `e2e/agentic-mesh-console.spec.ts` | 1 |

The API suite boots the real Fastify app in `UI_MOCK` mode against a temporary `RUNS_DIR`,
covers all 18 routes, and asserts the SSE replay contract. **No existing test file was
modified.**

---

## 9. Regression gate

Run on Windows (PowerShell), Node ≥ 20:

| Command | Result |
| :--- | :--- |
| `npm run build` | pass (exit 0) |
| `npm run typecheck:server` | pass |
| `npm run typecheck:ui` | pass |
| `npm test` | 18 files / **190** tests pass (176 pre-existing + 14 new) |
| `npm run test:ui` | 6 files / **37** tests pass |
| `npm run test:e2e` | 1 passed (dashboard → mock run → healing banner → approve repair) |
| `npm run build:ui` | pass |
| `npm run demo` | pass — v1 baseline → v2 refactor → auto-heal → report, unchanged output |
| `git diff --stat` | confined to the five files listed in §1 |

### Lint — pre-existing failures, unchanged

`npm run lint` currently reports **128 problems (63 errors, 65 warnings)**. This is the state
of the repository **before** this work, not a regression:

- Every reported file is untouched by this change set except `src/runner/agenticMeshRunner.ts`.
- That file reports **9 problems (3 errors, 6 warnings)** at `HEAD` (verified by linting the
  `HEAD` revision in a scratch file) and **9 problems (3 errors, 6 warnings)** after the hook
  addition — the same three `no-useless-assignment` errors (`locator`,
  `initialAttemptSucceeded`, `finalStatus`) and the same six `no-explicit-any` /
  `no-unused-vars` warnings, at shifted line numbers.

Fixing them would mean rewriting engine logic, which is outside the additive mandate.

---

## 10. Known limitations

- **No authentication.** The API is a local developer tool bound to `127.0.0.1` by default;
  it must sit behind a proxy with auth before being exposed.
- **Single-process queue.** Runs are serialised in memory, so a restart drops queued runs
  (completed runs are on disk and survive).
- **Mock mode in CI.** The regression gate and the e2e suite run with `UI_MOCK=1`; real Groq /
  Gemini / Jira calls are not exercised there, by design — they need credentials and network.
- **Allowlist by default.** Targets are limited to the bundled demo app, `localhost` and
  `saucedemo.com` unless `ALLOWED_TARGETS` is set.
- **Lint baseline** is red for pre-existing engine code (see §9).
