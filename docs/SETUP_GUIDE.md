# Setup & Execution Guide

> **Step-by-step Installation, Configuration, Verification, and Troubleshooting for Agentic-mesh**

---

## 1. Prerequisites

Before installing Agentic-mesh, ensure your system meets the following requirements:

- **Node.js**: `v20.0.0` or higher (LTS recommended). Check with `node -v`.
- **npm**: `v9.0.0` or higher. Check with `npm -v`.
- **Operating System**: Windows 10/11, macOS, or Ubuntu/Debian Linux.
- **Git**: Installed and configured.

---

## 2. Installation Steps

### Step 2.1: Clone or Open Workspace
Ensure you are located in the Agentic-mesh project root:
```powershell
cd d:\Agentic-mesh
```

### Step 2.2: Install NPM Dependencies
Install all required production and development dependencies:
```powershell
npm.cmd install
```
*(On Linux/macOS, run `npm install`)*

### Step 2.3: Install Playwright Chromium Browser
Install the Chromium browser binary used by Agentic-mesh's test runner:
```powershell
npx.cmd playwright install chromium
```

---

## 3. Environment Configuration

### Step 3.1: Initialize `.env`
Copy the template configuration file:
```powershell
cp .env.example .env
```

### Step 3.2: Configure API Credentials
Open `.env` in your editor and configure your API keys:

```dotenv
# =================================================================
# LLM Providers (Required for AI test synthesis and semantic healing)
# =================================================================
# Primary fast LPU inference (Free tier available at https://console.groq.com)
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b

# Secondary Multimodal Fallback (Google AI Studio at https://aistudio.google.com)
GEMINI_API_KEY=AIzaSy_your_gemini_key_here
GEMINI_MODEL=gemini-2.5-flash

# =================================================================
# Jira Cloud Integration (Optional - Falls back to mock if blank)
# =================================================================
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_EMAIL=your-email@domain.com
JIRA_API_TOKEN=your_jira_api_token_here

# =================================================================
# Runtime & Logging Configuration
# =================================================================
PORT=3456
HEADLESS=true
LOG_LEVEL=info
```

> [!NOTE]
> If you do not have a Jira account or live internet connection, **Agentic-mesh still runs completely offline** using `./fixtures/mock-ticket.json` and local deterministic generators!

---

## 4. Verification & Testing

Verify that your environment and all dependencies are working properly:

### 4.1 Run Unit & Integration Test Suite
```powershell
npm.cmd test
```
**Expected Outcome**: 17 test suites, 176 tests passing (~6.5 seconds).

### 4.2 Compile TypeScript Build
```powershell
npm.cmd run build
```
**Expected Outcome**: `tsc` compiles cleanly to `dist/` with 0 errors.

---

## 5. Running Agentic-mesh

### 5.1 Run the Automated 6-Phase Demo Showcase
The fastest way to experience Agentic-mesh's autonomous capabilities:
```powershell
npm.cmd run demo
```

**What the Showcase Does:**
1. **Phase 1 (Ingestion)**: Reads 4 acceptance criteria from `fixtures/mock-ticket.json`.
2. **Phase 2 (Synthesis)**: Uses Groq LLM to synthesize 4 Playwright test cases (16 atomic actions).
3. **Phase 3 (Baseline Run)**: Executes tests on `demo/index.html` (Baseline v1) $\rightarrow$ **100% Pass**.
4. **Phase 4 (Refactor Simulation)**: Loads mutated app `demo/index.html?v=2` where all button IDs, input names, and class names have changed.
5. **Phase 5 (Self-Healing)**: Detects broken locators, computes similarity matrix, repairs all 15 broken locators autonomously, and replays each step $\rightarrow$ **100% Pass (Healed)**.
6. **Phase 6 (Reporting)**: Generates `reports/report.html`, `reports/report.md`, and prints terminal summary.

---

### 5.2 Running via the CLI

#### Run Offline Mock Mode on Mutated Demo:
```powershell
npm.cmd run agentic-mesh -- run --mock --url demo/index.html?v=2
```

#### Run with Live Headed Browser (Watch Browser Actions):
```powershell
npm.cmd run agentic-mesh -- run --mock --url demo/index.html?v=2 --no-headless
```

#### Run Against Live Jira Ticket with Comment Posting:
```powershell
npm.cmd run agentic-mesh -- run --ticket QA-101 --url demo/index.html --post-to-jira
```

#### Run Flaky Test Detection Sweep (3 Iterations):
```powershell
npm.cmd run agentic-mesh -- run --mock --url demo/index.html --repeat 3
```

---

## 6. Inspecting Generated Reports

After any execution run, inspect the generated artifacts in `reports/`:

- **Interactive HTML Dashboard**:
  Open `reports/report.html` in your browser to view status badges, test metrics, and before/after visual diffs.
- **Markdown Report**:
  View `reports/report.md` for clean GitHub-compatible tables.
- **Repair Audit Trail**:
  Inspect `reports/repairs.jsonl` to see every single element locator substitution, similarity score, and rationale.

---

## 7. Troubleshooting & FAQ

### Issue: PowerShell blocks running scripts (`npm : File ... cannot be loaded`)
**Cause**: Windows PowerShell execution policy is restricted.  
**Fix**: Call `npm.cmd` and `npx.cmd` directly instead of `npm` and `npx`.

### Issue: `net::ERR_NETWORK_ACCESS_DENIED` on localhost
**Cause**: Restricted sandbox or firewall rules blocking local port binding.  
**Fix**: Use absolute `file:///` URLs. Playwright natively supports full DOM and query string parameters on local files:
```powershell
npm.cmd run agentic-mesh -- run --mock --url demo/index.html?v=2
```

### Issue: Playwright throws `Executable doesn't exist`
**Cause**: Chromium browser binaries are not installed.  
**Fix**: Run `npx.cmd playwright install chromium`.

### Issue: Groq Model returns 404
**Cause**: The requested model name is not provisioned on your Groq tier.  
**Fix**: In `.env`, set `GROQ_MODEL=openai/gpt-oss-120b` or `qwen/qwen3.8-27b`.

