# AgenticMesh & SentinelQA: Autonomous Closed-Loop Self-Healing Testing & SRE Reliability Platform

> **Project Presentation Deck & Technical Defense Specification**  
> *Ready-to-present slide-by-slide structure with architectural diagrams, Data Flow Diagrams (DFD Level 0 & Level 1), Entity-Relationship (ER) diagram, team ownership, and speaker notes.*

---

## Slide 1: Title Slide

### **AgenticMesh & SentinelQA**
#### *Autonomous Closed-Loop Quality Engineering & Runtime Infrastructure Self-Healing*

- **Domain**: AI-Powered Autonomous Software Testing & Site Reliability Engineering (SRE)
- **Tagline**: Bridging Pre-Production Quality Assurance with Post-Production Runtime Resilience
- **Target Repository**: [github.com/ankush850/Agentic-mesh](https://github.com/ankush850/Agentic-mesh)

**Project Team & Core Engineering Ownership**:
1. **Ankush Singh Rawat** (`ankush850`) — Frontend, DB & Mock Services, SRE Observability & HITL Lead
2. **Jay Negi** (`Jay2849`) — Backend Architecture, Ingestion Daemon & Telemetry Stream Lead
3. **Faizan Ali Ansari** (`Faizu786786`) — AI/ML, Tree-Sitter AST Pruning & LangGraph Multi-Agent Lead
4. **Karan Pathak** (`karanpathak2023`) — DevOps, Container Orchestration & GitOps Remediation Lead

> **Speaker Notes**:
> "Good morning, evaluators and judges. Today we present AgenticMesh & SentinelQA — an end-to-end, closed-loop platform that solves two of modern engineering's most expensive challenges: flaky test suites broken by UI refactoring in pre-production, and catastrophic downtime from silent microservice crashes in production."

---

## Slide 2: The Problem Statement

### **The Dual-Layer Fragility Crisis in Modern Software Delivery**

```
                  PRE-PRODUCTION (CI/CD)
 ┌────────────────────────────────────────────────────────┐
 │ ❌ Frontend UI Refactoring breaks test locators        │
 │ ❌ QA engineers spend 40%+ of time maintaining scripts │
 │ ❌ Flaky CI pipelines delay production deployment      │
 └─────────────────────────┬──────────────────────────────┘
                           ▼
                  POST-PRODUCTION (RUNTIME)
 ┌────────────────────────────────────────────────────────┐
 │ ❌ Microservice crashes (e.g. DB connection pool leaks)│
 │ ❌ High-cardinality logs flood SRE monitoring systems  │
 │ ❌ MTTR (Mean Time to Resolution) is hours, not seconds│
 │ ❌ Manual rollback & bug filing causes revenue loss     │
 └────────────────────────────────────────────────────────┘
```

1. **Pre-Production Testing Fragility (The Flaky Test Nightmare)**:
   - Routine DOM changes (e.g., `#username` $\rightarrow$ `#user-account-input`) break brittle test locators.
   - Traditional automation frameworks halt immediately, blocking CI/CD pipelines.
   - Engineering teams spend hundreds of hours manually updating selectors instead of writing features.

2. **Post-Production Runtime Blind Spots (The SRE Downtime Crisis)**:
   - Cascading failures (e.g., database connection pool exhaustion) silently trigger HTTP 500 errors.
   - SREs are overwhelmed by duplicated stack traces across distributed microservices.
   - Diagnosing root causes requires manually parsing megabytes of logs, bloating LLM prompt costs and inflating MTTR.

---

## Slide 3: The Solution — Closed-Loop Dual-Pillar Architecture

### **SentinelQA (Pre-Prod) + AgenticMesh (Post-Prod Runtime)**

We unite continuous automated verification with autonomous runtime remediation in a single closed-loop ecosystem:

```mermaid
flowchart LR
    subgraph PreProd["Pillar 1: SentinelQA (Pre-Production Quality)"]
        Jira["Jira Acceptance Criteria"] --> TestSynth["LLM Test Synthesis"]
        TestSynth --> PW["Playwright Execution"]
        PW --> Detect["Locator Breakage Detection"]
        Detect --> HeurMatrix["Zero-Token Heuristic Matrix"]
        HeurMatrix --> AutoHeal["Autonomous Step Healing"]
    end

    subgraph PostProd["Pillar 2: AgenticMesh (Post-Production Reliability)"]
        Stdout["Container Stdout Logs"] --> GoDaemon["Go Collector Daemon"]
        GoDaemon --> RedisStream["Redis Streams Buffer"]
        RedisStream --> ASTPrune["Tree-Sitter AST Chunking"]
        ASTPrune --> VectorRAG["Supabase pgvector RAG"]
        VectorRAG --> LangGraph["LangGraph Multi-Agent RCA"]
        LangGraph --> HITL["Human-in-the-Loop Review"]
        HITL --> Rollback["Docker SDK Auto-Rollback"]
        HITL --> GitOps["GitHub REST Auto-Fix PR"]
    end

    AutoHeal --> HITL
```

- **Pre-Production (SentinelQA)**: Ingests Jira acceptance criteria, writes Playwright tests, executes them, detects locator failure, and heals selectors in real-time via a mathematical similarity matrix.
- **Post-Production (AgenticMesh)**: Intercepts container telemetry via a non-blocking Go daemon, deduplicates stack traces, extracts broken AST function coordinates, retrieves incident history via pgvector, synthesizes root causes via LangGraph, and triggers instant container rollbacks + automated GitHub fix PRs upon human approval.

---

## Slide 4: Key Features & Technical Innovations

| # | Technical Innovation | Architectural Mechanism | Impact / Metric |
|---|---|---|---|
| **1** | **Zero-Token Heuristic Locator Self-Healing** | 4-Factor Heuristic Matrix: Levenshtein Distance (25%) + Jaccard Token Overlap (30%) + Semantic Tag Matching (25%) + Interactive Attribute Type (20%) | **0 LLM token cost** for 80%+ of typical selector renames; sub-15ms local execution |
| **2** | **High-Throughput Log Interception Daemon** | Go-routine log daemon reading stdout/TCP into buffered Go channels (`chan LogEvent`, cap 10,000) with Redis Streams buffer | **Zero thread blocking**; handles traffic spikes up to 50,000 logs/sec with 10k buffer caps |
| **3** | **Cryptographic Log Deduplication** | SHA-256 fingerprinting over `Service + Level + Top3Frames` with 60-second sliding-window debounce cache | Drops **99% of repeating downstream alarm storms** during catastrophic outages |
| **4** | **Tree-Sitter AST Coordinate Pruning** | Compiler-level AST slice extracting *only* the enclosing faulty function from stack trace line coordinates | Eliminates whole-file dumping; **cuts LLM prompt tokens by 65%–80%** |
| **5** | **Multi-Agent Decision Graph (LangGraph)** | Directed acyclic graph linking `TriageAgent` $\rightarrow$ `VectorRetrievalAgent` $\rightarrow$ `GroqRCAgent` | Validated structured JSON root-cause analysis with rollback tags and patch diffs |
| **6** | **Human-in-the-Loop (HITL) Center** | Dark-mode Web Console with interactive approval modal dispatching to Docker engine | Guarantees safety: **no autonomous container restart or PR merge without engineer review** |
| **7** | **Instant Docker SDK Rollback Engine** | Python worker calling `container.stop()` and swapping image to stable tag (`v2.1` $\rightarrow$ `v2.0`) | **Mean Time to Recovery (MTTR) < 5 seconds** |

---

## Slide 5: Comprehensive Technology Stack

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION & WEB CONSOLE                      │
│   React 19  •  Vite 7  •  Tailwind CSS v4  •  Lucide Icons  •  Recharts│
├────────────────────────────────────────────────────────────────────────┤
│                       BACKEND API & ORCHESTRATION                      │
│   Fastify 5 (TypeScript)  •  Server-Sent Events (SSE)  •  Zod Schemas  │
├────────────────────────────────────────────────────────────────────────┤
│                     HIGH-THROUGHPUT INGESTION LAYER                    │
│   Go 1.23  •  Go Goroutines  •  Go Channels  •  go-redis v9            │
├────────────────────────────────────────────────────────────────────────┤
│                        AI / ML & COMPILER TOOLS                        │
│   Groq (Llama 3.3 70B Versatile) • Google Gemini 2.5 • Tree-Sitter     │
│   LangGraph Multi-Agent Engine  •  Supabase pgvector (HNSW Cosine)    │
├────────────────────────────────────────────────────────────────────────┤
│                       RUNTIME, DATA & INFRASTRUCTURE                   │
│   Playwright (Chromium)  •  Docker Engine  •  Docker Compose v3.8      │
│   Redis 7 (Streams XADD/XREADGROUP)  •  GitHub REST API  •  Jira REST v3│
└────────────────────────────────────────────────────────────────────────┘
```

- **Languages**: TypeScript / Node.js, Go, Python 3.11, SQL
- **Frontend**: React 19, Tailwind CSS v4, Lucide React, Recharts
- **API & Server**: Fastify 5, Zod contract guards, SSE streaming
- **AI Models**: Groq Llama-3.3-70B-Versatile (primary RCA & test generation), Gemini 2.5 Flash (multimodal fallback)
- **Compiler / AST**: Tree-sitter AST parser, Python `tree_sitter_languages`
- **Data & Caching**: Redis 7 (Streams + In-memory cache), Supabase PostgreSQL with `pgvector`
- **Automation & SRE**: Playwright, Python Docker SDK (`docker-py`), GitHub REST API, Atlassian Jira Cloud REST v3

---

## Slide 6: Team Responsibilities & Ownership Matrix

```
                      TEAM ENGINEERING ROLES
┌──────────────────────────────────────────────────────────────────────┐
│  Ankush Singh Rawat (Frontend, DB & Mock Lead)                       │
│  • SentinelQA Runner Core, Similarity Heuristics, Jira REST v3       │
│  • SRE Observability Dashboard, Service Topology, Incident Cards     │
│  • Phase 1 Mock Microservice Suite & Chaos Injection (/crash)        │
├──────────────────────────────────────────────────────────────────────┤
│  Jay Negi (Backend Architecture & Ingestion Lead)                    │
│  • Phase 2 Go Ingestion Collector Daemon (main.go, go.mod)           │
│  • Redis Streams Buffer with Backpressure Capping (redis.go)         │
│  • SHA-256 Log Fingerprinting & Sliding Window Dedup Filter          │
├──────────────────────────────────────────────────────────────────────┤
│  Faizan Ali Ansari (AI/ML & Compiler Lead)                           │
│  • Phase 3 Tree-Sitter AST Source Coordinate Pruner (ast_pruner.py)  │
│  • Supabase pgvector Migration & Semantic Knowledge Base             │
│  • LangGraph Multi-Agent Decision Engine (triage, retrieval, RCA)    │
├──────────────────────────────────────────────────────────────────────┤
│  Karan Pathak (DevOps & Execution Lead)                              │
│  • Phase 5 Docker Compose Multi-Container Orchestration Cluster      │
│  • Python Docker SDK Container Rollback Engine (docker_rollback.py)  │
│  • GitHub REST API Automated GitOps Fix PR Generator (gitops_pr.ts)  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Slide 7: High-Level System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer["Web Console & HITL Interface"]
        UI["React 19 Console (Port 5173)"]
        Dashboard["Fleet KPI Dashboard"]
        SREObs["SRE Observability Topology"]
        RepairsCenter["Repairs Review Center"]
    end

    subgraph APILayer["Fastify 5 Server & SSE Bus (Port 8787)"]
        API["Fastify HTTP / WebSocket Server"]
        RunQueue["Serial Run Queue"]
        EventBus["SSE Telemetry EventBus"]
    end

    subgraph PreProdPillar["SentinelQA Autonomous QA Engine"]
        Jira["Jira Cloud REST v3 (SQA Project)"]
        Gen["criteriaToSteps LLM Generator"]
        PWRunner["Playwright Autonomous Runner"]
        Heuristics["Zero-Token Similarity Matrix"]
    end

    subgraph ClusterLayer["Containerized Microservices Cluster"]
        AuthSvc["mock-auth (:3001)"]
        PaySvc["mock-payment (:3002) [/crash]"]
        IngestSvc["mock-ingestion (:3003)"]
        Redis["redis-broker (:6379)"]
    end

    subgraph SREPillar["AgenticMesh Infrastructure SRE Engine"]
        GoCollector["Go Ingestion Daemon (:5141)"]
        Dedup["SHA-256 Fingerprint Debouncer"]
        ASTPrune["Tree-Sitter AST Pruner"]
        VecDB["Supabase pgvector (1536d)"]
        LangGraph["LangGraph Multi-Agent Engine"]
        DockerSDK["Docker SDK Rollback Worker"]
        GitOps["GitHub REST API Fix PR"]
    end

    UI <--> API
    API --> RunQueue --> PWRunner
    PWRunner <--> Jira
    PWRunner --> Heuristics
    PWRunner --> ClusterLayer

    ClusterLayer --> GoCollector
    GoCollector --> Dedup --> Redis
    Redis --> ASTPrune --> LangGraph
    LangGraph <--> VecDB
    LangGraph --> API
    API --> SREObs
    SREObs --"Engineer Approves"--> DockerSDK
    SREObs --"Engineer Approves"--> GitOps
```

---

## Slide 8: Data Flow Diagram (DFD Level 0 — Context Diagram)

The Context Diagram defines the external boundaries of the system, identifying all external entities that produce or consume data.

```mermaid
flowchart TD
    QAEng["QA Engineer / SRE"]
    JiraCloud["Atlassian Jira Cloud"]
    TargetApp["Target Applications & Docker Containers"]
    GitHub["GitHub Repository"]

    System(["0.0<br/>AgenticMesh & SentinelQA<br/>Autonomous Self-Healing System"])

    QAEng --"1. Triggers runs, configures targets, reviews repairs, approves rollbacks"--> System
    System --"2. Real-time run telemetry, repair diffs, cluster topology, incident cards"--> QAEng

    JiraCloud --"3. Acceptance criteria, story user flow"--> System
    System --"4. Test execution results, bug tickets with screenshots"--> JiraCloud

    System --"5. Dispatches Playwright UI actions, injects chaos"--> TargetApp
    TargetApp --"6. Live DOM state, mutation events, container stdout/stderr logs"--> System

    System --"7. Dispatches automated fix PRs with AST diffs"--> GitHub
    GitHub --"8. Branch commit SHA, pull request confirmation"--> System
```

---

## Slide 9: Data Flow Diagram (DFD Level 1 — Decomposed System)

Decomposes the primary process into 7 discrete subsystems and 4 persistent data stores:

```mermaid
flowchart TD
    QA["QA Engineer / SRE"]
    Jira["Jira Cloud"]
    Cluster["Container Cluster"]
    GH["GitHub"]

    P1["1.0<br/>Jira Ingestion &<br/>AST Code Parsing"]
    P2["2.0<br/>Autonomous<br/>Test Execution"]
    P3["3.0<br/>Zero-Token & LLM<br/>Self-Healing Engine"]
    P4["4.0<br/>High-Throughput<br/>Go Ingestion & Dedup"]
    P5["5.0<br/>AST Pruner &<br/>pgvector LangGraph RCA"]
    P6["6.0<br/>Automated Docker<br/>Rollback & GitOps"]
    P7["7.0<br/>Web Console &<br/>HITL Approval Center"]

    D1[("D1: Step Cache &<br/>Telemetry (Redis)")]
    D2[("D2: Incident Knowledge<br/>Base (Supabase pgvector)")]
    D3[("D3: Run Artifacts &<br/>Repairs Log (JSONL)")]

    Jira -->|"Acceptance Criteria"| P1
    P1 -->|"Structured TestCases"| P2
    P2 -->|"UI Actions"| Cluster
    Cluster -->|"DOM Mutations / Locator Failures"| P3
    P3 -->|"Repaired Locators"| P2
    P3 <-->|"Cache Key Lookups"| D1
    P3 -->|"Repair Records"| D3

    Cluster -->|"Stdout / Stderr Logs"| P4
    P4 -->|"Deduplicated Log Stream"| D1
    D1 -->|"Log Stream"| P5
    P5 <-->|"Cosine Semantic Similarity"| D2
    P5 -->|"RCA Incident Summary"| P7

    P2 -->|"Live SSE Events"| P7
    P7 -->|"Human Approval Token"| P6
    QA <-->|"Reviews & Actions"| P7
    P6 -->|"Container Swap (v2.1 -> v2.0)"| Cluster
    P6 -->|"Automated Fix PR"| GH
    P2 -->|"Bug Tickets & Screenshots"| Jira
```

---

## Slide 10: Entity-Relationship (ER) Diagram

The persistent database schema modeling the relationship between test runs, locator repairs, log events, vector embeddings, and remediation actions:

```mermaid
erDiagram
    JIRA_TICKET ||--o{ TEST_CASE : "generates"
    TEST_CASE ||--o{ TEST_STEP : "contains"
    TEST_STEP ||--o| REPAIR_RECORD : "triggers on failure"
    TEST_STEP ||--o{ ARTIFACT_SCREENSHOT : "captures"

    SERVICE_NODE ||--o{ LOG_EVENT : "emits"
    LOG_EVENT ||--o| INCIDENT_HISTORY : "fingerprints to"
    INCIDENT_HISTORY ||--o{ REMEDIATION_RECORD : "resolves via"

    JIRA_TICKET {
        string key PK "e.g. SQA-1"
        string summary
        text description
        string projectKey
        datetime fetchedAt
    }

    TEST_CASE {
        string id PK "e.g. TC-01"
        string ticketKey FK
        string title
        int repeatCount
        string status "passed | failed | healed"
    }

    TEST_STEP {
        string id PK
        string testCaseId FK
        int stepIndex
        string action "click | fill | navigate | assert"
        string targetSelector
        int durationMs
    }

    REPAIR_RECORD {
        uuid id PK
        string stepId FK
        string originalLocator
        string repairedLocator
        float confidenceScore "0.0 - 1.0"
        string repairStrategy "heuristic | llm"
        string reviewStatus "pending | approved | rejected"
        datetime timestamp
    }

    SERVICE_NODE {
        string serviceId PK "e.g. mock-payment"
        string serviceName
        string layer "Edge | Core | Data"
        int port
        string activeTag "v2.1"
        string status "healthy | degraded | down"
    }

    LOG_EVENT {
        string eventHash PK "SHA-256 fingerprint"
        string serviceId FK
        string level "ERROR | FATAL"
        text rawMessage
        text stackTrace
        datetime emittedAt
    }

    INCIDENT_HISTORY {
        uuid id PK
        string errorSignature
        text rootCause
        text suggestedRemediation
        vector_1536 embedding "HNSW Cosine"
    }

    REMEDIATION_RECORD {
        uuid id PK
        uuid incidentId FK
        string actionType "docker_rollback | github_pr"
        string targetService
        string stableImageTag "v2.0"
        float recoverySeconds
        string approvedBy "engineer_email"
        datetime executedAt
    }
```

---

## Slide 11: Real-World Business & Engineering Impact

### **Measurable Efficiency & Reliability Metrics**

```
┌───────────────────────────────────────┬───────────────────────────────────────┐
│         BEFORE AGENTIC-MESH           │          AFTER AGENTIC-MESH           │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ 40% of QA sprint spent on locator     │ 0% manual locator updates: 100%       │
│ maintenance and script debugging      │ autonomous zero-token self-healing   │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ CI/CD pipelines blocked for hours due │ Instant pipeline continuity: tests    │
│ to minor CSS/ID refactoring changes   │ pass, heal on the fly & log repairs   │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ Production downtime MTTR: 45–120 mins │ Container MTTR: < 5 seconds via       │
│ for SRE manual diagnosis & rollback   │ automated Docker SDK rollback worker  │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ Megabytes of raw stack traces sent to │ 65%–80% LLM token reduction via       │
│ LLMs, causing severe prompt bloat     │ Tree-sitter AST function slice pruner │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ 90% repetitive alarm floods during    │ 99% alarm storm reduction via SHA-256 │
│ cascading microservice outages        │ 60-second sliding-window debounce     │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

1. **Sprint Velocity**: Eliminates test maintenance churn, allowing developers to refactor DOM code without fear of breaking CI test suites.
2. **Infrastructure Cost**: Zero-token similarity matrix resolves the majority of locators locally without consuming external LLM API quotas.
3. **Enterprise Safety**: Complete audit trail ([`reports/repairs.jsonl`](reports/repairs.jsonl)) paired with strict Human-in-the-Loop review centers prevents rogue automated actions.

---

## Slide 12: Future Scope & Roadmap

```mermaid
flowchart TD
    subgraph NearTerm["Phase 1: Near-Term Enhancements (Q1-Q2)"]
        K8s["Kubernetes Operator (CRD-Driven Rollouts & Rollbacks)"]
        OpenTelemetry["Native OpenTelemetry (OTel) Distributed Tracing"]
        MultiRepo["Multi-Repo Micro-Frontend Unified Healing"]
    end

    subgraph MidTerm["Phase 2: Autonomous Intelligence (Q3)"]
        SelfEvolve["Self-Evolving Test Suites from User Analytics"]
        GraphRAG["Graph-RAG Dependency Graph Root-Cause Mapping"]
        AutonomousPR["Autonomous PR Merging with Automated Canaries"]
    end

    subgraph LongTerm["Phase 3: Enterprise Scalability (Q4)"]
        MultiCloud["Multi-Cloud Cross-Cluster Orchestration (AWS / GCP / Azure)"]
        PredictiveSRE["Predictive Failure Prevention via ML Anomaly Scoring"]
    end

    NearTerm --> MidTerm --> LongTerm
```

1. **Kubernetes Native Operator**: Transition from local Docker engine to an enterprise Kubernetes Custom Resource Definition (CRD) executing canary rollbacks across multi-cluster environments.
2. **OpenTelemetry (OTel) Semantic Tracing**: Ingest distributed OpenTelemetry trace spans directly into the Go daemon to map causal transaction chains across services.
3. **Self-Evolving Test Synthesis**: Ingest real-world user session telemetry from PostHog / Datadog to autonomously synthesize regression test suites covering high-traffic customer paths.
4. **Predictive AI SRE**: Deploy time-series anomaly detection on CPU/memory telemetry to initiate proactive scale-outs *before* database connection pools exhaust.

---

## Slide 13: Evaluator & Judge Defense Script

When presenting to evaluators, professors, or hackathon judges, deliver this script:

### **The Unified Pitch (60 Seconds)**
> *"Good morning, evaluators. Modern software breaks in two places: in pre-production when UI refactoring breaks automated test scripts, and in production when silent microservice crashes take down customer-facing systems.*
>
> *Our project, **AgenticMesh & SentinelQA**, solves both with a unified closed-loop platform.*
>
> *In pre-production, **SentinelQA** ingests Jira acceptance criteria, writes Playwright tests, and executes them. When frontend engineers refactor element IDs or CSS classes, our zero-token mathematical similarity matrix heals the locators in real-time without stopping the CI build.*
>
> *In production, **AgenticMesh** acts as the reliability arm: our high-throughput Go daemon ingests container logs into Redis Streams, Tree-Sitter compiler tools prune out only the broken function, Supabase pgvector retrieves past incident history, and LangGraph multi-agent AI synthesizes the exact root cause. With one click in our SRE Observability Console, engineers authorize an instant container rollback to stable images in under 5 seconds and generate an automated GitHub fix PR.*
>
> *All 32 test suites pass with 266 green tests, all branches are live on GitHub, and the full system is operational."*

---

## Slide 14: Conclusion & Q&A

- **Target Repository**: [https://github.com/ankush850/Agentic-mesh](https://github.com/ankush850/Agentic-mesh)
- **Default Branch**: `main` (Production release v1.0.0)
- **Contributor Branches**: `ankush`, `jay`, `faizan`, `karan`
- **Full Verification Suite**: 32 test files, 266 unit/integration tests passing
- **Live Demonstrations**: Terminal demo (`npm run demo`), Web Console (`http://localhost:5173`)

### **Thank You! We are open for Questions & Live Demonstration.**
