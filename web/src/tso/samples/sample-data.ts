/**
 * Coherent Sample Suite Data (Section 4).
 * Exports HTML, CSS, and JS samples for in-memory benchmarking and UI sample loading.
 */

export const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Agentic-mesh Cloud Dashboard and Quality Engineering Portal">
  <title>Agentic-mesh Enterprise Console</title>

  <!-- External Stylesheets (FR-P5) -->
  <link rel="stylesheet" href="styles.css">

  <!-- Inline Style Block with injection parsing (FR-I3) -->
  <style>
    .inline-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      background-color: var(--surface-3, #16223a);
      color: var(--accent, #38bdf8);
    }
    .inline-badge:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body class="theme-dark sentinel-app">
  <!-- Top Navigation Landmark (FR-P2) -->
  <header class="app-header" role="banner">
    <nav class="nav-container" aria-label="Main Navigation">
      <div class="brand-logo">
        <span class="logo-icon">🛡️</span>
        <h1 class="brand-title">Agentic-mesh Platform</h1>
      </div>
      <ul class="nav-links">
        <li class="nav-item active"><a href="#dashboard" class="nav-link">Dashboard</a></li>
        <li class="nav-item"><a href="#test-runs" class="nav-link">Test Runs</a></li>
        <li class="nav-item"><a href="#self-healing" class="nav-link">Self-Healing</a></li>
        <li class="nav-item"><a href="#reports" class="nav-link">Reports</a></li>
        <li class="nav-item"><a href="#settings" class="nav-link">Settings</a></li>
      </ul>
      <div class="header-actions">
        <button id="theme-toggle-btn" class="btn btn-ghost" aria-label="Toggle theme">🌓</button>
        <button id="notifications-btn" class="btn btn-ghost" aria-label="View notifications">🔔</button>
      </div>
    </nav>
  </header>

  <!-- Main Content Landmark (FR-P2) -->
  <main id="main-content" class="app-main" role="main">
    <!-- Hero / Summary Section -->
    <section id="summary-section" class="section hero-card" aria-labelledby="summary-heading">
      <h2 id="summary-heading" class="section-title">Autonomous QA Test Execution & Self-Healing</h2>
      <p class="section-desc">
        Real-time telemetry, locator drift compensation, and AI verification for continuous delivery pipelines.
      </p>
      <div class="stats-grid">
        <div class="stat-box" data-metric="total-runs">
          <span class="stat-label">Total Test Executions</span>
          <span class="stat-value">1,428</span>
        </div>
        <div class="stat-box" data-metric="pass-rate">
          <span class="stat-label">Pass Rate</span>
          <span class="stat-value">99.4%</span>
        </div>
        <div class="stat-box" data-metric="healed-locators">
          <span class="stat-label">Healed Locators</span>
          <span class="stat-value">87</span>
        </div>
      </div>
    </section>

    <!-- Run Configuration Form (FR-P2) -->
    <section id="run-config-section" class="section card-panel">
      <h3 class="panel-title">Execute New Automated Test Run</h3>
      <form id="new-run-form" class="qa-form" action="/api/runs" method="POST">
        <div class="form-group">
          <label for="suite-name" class="form-label">Test Suite Identifier</label>
          <input type="text" id="suite-name" name="suiteName" class="form-input" placeholder="e.g. regression-e2e-auth" required>
        </div>

        <div class="form-group">
          <label for="target-url" class="form-label">Base Application URL</label>
          <input type="url" id="target-url" name="targetUrl" class="form-input" placeholder="https://staging.agentic-mesh.io" required>
        </div>

        <div class="form-group">
          <label for="environment-select" class="form-label">Execution Target Environment</label>
          <select id="environment-select" name="environment" class="form-select">
            <option value="staging">Staging Cluster (US-East)</option>
            <option value="production">Production Canary (Multi-Region)</option>
            <option value="ephemeral">Ephemeral PR Preview</option>
          </select>
        </div>

        <div class="form-actions">
          <button type="submit" id="login-btn" class="btn btn-primary" onclick="console.log('Execute Run clicked')">
            Trigger Execution
          </button>
          <button type="reset" id="reset-btn" class="btn btn-secondary">
            Reset Configuration
          </button>
        </div>
      </form>
    </section>

    <!-- Test Cases List with Repeated Siblings (FR-P2 collapsing test) -->
    <section id="test-list-section" class="section card-panel">
      <h3 class="panel-title">Active Test Case Roster</h3>
      <ul id="test-case-list" class="roster-list">
        <li class="item test-item" data-status="passed">
          <span class="test-name">Authentication Flow: Valid user password login</span>
          <span class="status-badge passed">PASSED</span>
        </li>
        <li class="item test-item" data-status="passed">
          <span class="test-name">Locator Drift: Profile button renamed in v2</span>
          <span class="status-badge healed">HEALED</span>
        </li>
        <li class="item test-item" data-status="passed">
          <span class="test-name">Shopping Cart: Add item to persistent session</span>
          <span class="status-badge passed">PASSED</span>
        </li>
        <li class="item test-item" data-status="passed">
          <span class="test-name">Checkout Pipeline: Apply discount voucher code</span>
          <span class="status-badge passed">PASSED</span>
        </li>
        <li class="item test-item" data-status="passed">
          <span class="test-name">Jira Integration: Bi-directional defect sync</span>
          <span class="status-badge passed">PASSED</span>
        </li>
        <li class="item test-item" data-status="passed">
          <span class="test-name">Session Expiry: Inactive timeout redirect to auth</span>
          <span class="status-badge passed">PASSED</span>
        </li>
        <li class="item test-item" data-status="passed">
          <span class="test-name">Data Export: Generate compliance audit report</span>
          <span class="status-badge passed">PASSED</span>
        </li>
        <li class="item test-item" data-status="passed">
          <span class="test-name">Webhook Receiver: Dispatch telemetry alerts</span>
          <span class="status-badge passed">PASSED</span>
        </li>
      </ul>
    </section>
  </main>

  <!-- Aside Landmark -->
  <aside id="agent-telemetry-sidebar" class="app-sidebar" role="complementary">
    <h4 class="sidebar-heading">Agent Telemetry</h4>
    <div class="telemetry-card">
      <span class="telemetry-label">Active Worker Memory</span>
      <span class="telemetry-stat">142 MB</span>
    </div>
  </aside>

  <!-- Footer Landmark (FR-P2) -->
  <footer id="app-footer" class="app-footer" role="contentinfo">
    <div class="footer-content">
      <p class="copyright-notice">© 2026 Agentic-mesh Systems Inc. All rights reserved.</p>
      <div class="footer-links">
        <a href="#privacy" class="footer-link">Privacy Policy</a>
        <a href="#terms" class="footer-link">Terms of Service</a>
      </div>
    </div>
  </footer>

  <!-- External Script Reference (FR-P5) -->
  <script src="app.js"></script>

  <!-- Inline Script Block with injection parsing (FR-I3) -->
  <script>
    console.info("Agentic-mesh inline bootstrap initialized successfully.");
  </script>
</body>
</html>`;

export const SAMPLE_CSS = `/* ==========================================================================
   Agentic-mesh Enterprise Console Stylesheet
   Demonstrates custom properties, media queries, keyframes, and specificities.
   ========================================================================== */

:root {
  /* Declared CSS Custom Properties (FR-P3) */
  --tso-primary: #38bdf8;
  --tso-primary-hover: #0ea5e9;
  --tso-bg: #070b14;
  --tso-surface: #0d1424;
  --tso-surface-2: #111b2f;
  --tso-surface-3: #16223a;
  --tso-border: #1f2c45;
  --tso-text-primary: #e8eefb;
  --tso-text-muted: #93a3bd;
  --tso-success: #10b981;
  --tso-warning: #f59e0b;
  --tso-danger: #ef4444;
  --tso-radius-sm: 6px;
  --tso-radius-md: 12px;
  --tso-radius-lg: 16px;
  --tso-shadow-card: 0 18px 40px -24px rgb(0 0 0 / 0.85);
  --tso-transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Base Body Layout */
body.sentinel-app {
  margin: 0;
  padding: 0;
  background-color: var(--tso-bg);
  color: var(--tso-text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.5;
  min-height: 100vh;
}

/* Header & Navigation Landmark */
header.app-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background-color: var(--tso-surface);
  border-bottom: 1px solid var(--tso-border);
  box-shadow: var(--tso-shadow-card);
}

.nav-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1300px;
  margin: 0 auto;
  padding: 0.75rem 1.5rem;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.brand-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
  color: var(--tso-text-primary);
}

.nav-links {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 1.25rem;
}

.nav-item a.nav-link {
  color: var(--tso-text-muted);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: var(--tso-transition);
}

.nav-item.active a.nav-link,
.nav-item a.nav-link:hover {
  color: var(--tso-primary);
}

/* Main Layout Grid */
main.app-main {
  max-width: 1300px;
  margin: 2rem auto;
  padding: 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Hero Summary Section */
section.hero-card {
  background-color: var(--tso-surface);
  border: 1px solid var(--tso-border);
  border-radius: var(--tso-radius-lg);
  padding: 2rem;
  box-shadow: var(--tso-shadow-card);
}

h2.section-title {
  margin-top: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--tso-text-primary);
}

p.section-desc {
  color: var(--tso-text-muted);
  font-size: 0.95rem;
  max-width: 48rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.25rem;
  margin-top: 1.5rem;
}

.stat-box {
  background-color: var(--tso-surface-2);
  border: 1px solid var(--tso-border);
  border-radius: var(--tso-radius-md);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--tso-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--tso-primary);
}

/* Card Panels */
section.card-panel {
  background-color: var(--tso-surface);
  border: 1px solid var(--tso-border);
  border-radius: var(--tso-radius-lg);
  padding: 1.75rem;
}

h3.panel-title {
  margin-top: 0;
  font-size: 1.125rem;
  font-weight: 600;
  border-bottom: 1px solid var(--tso-border);
  padding-bottom: 0.75rem;
  margin-bottom: 1.25rem;
}

/* Forms & Inputs */
.qa-form {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

label.form-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--tso-text-muted);
}

input.form-input,
select.form-select {
  background-color: var(--tso-surface-2);
  border: 1px solid var(--tso-border);
  border-radius: var(--tso-radius-sm);
  color: var(--tso-text-primary);
  padding: 0.6rem 0.85rem;
  font-size: 0.875rem;
  outline: none;
  transition: var(--tso-transition);
}

input.form-input:focus,
select.form-select:focus {
  border-color: var(--tso-primary);
  box-shadow: 0 0 0 2px rgb(56 189 248 / 0.25);
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

/* Buttons */
button.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: var(--tso-radius-sm);
  padding: 0.6rem 1.25rem;
  cursor: pointer;
  border: none;
  transition: var(--tso-transition);
}

button.btn-primary {
  background-color: var(--tso-primary);
  color: #04121f;
}

button.btn-primary:hover {
  background-color: var(--tso-primary-hover);
}

button.btn-secondary {
  background-color: var(--tso-surface-3);
  color: var(--tso-text-primary);
  border: 1px solid var(--tso-border);
}

button.btn-ghost {
  background: transparent;
  color: var(--tso-text-muted);
  padding: 0.4rem 0.6rem;
}

/* Repeated Roster List */
ul.roster-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

li.test-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: var(--tso-surface-2);
  border: 1px solid var(--tso-border);
  border-radius: var(--tso-radius-sm);
}

span.status-badge.passed {
  color: var(--tso-success);
  background-color: rgb(16 185 129 / 0.15);
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

span.status-badge.healed {
  color: var(--tso-warning);
  background-color: rgb(245 158 11 / 0.15);
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

/* Intentional duplicate selector to test duplicate detection (FR-P3) */
button.btn-primary {
  box-shadow: 0 4px 12px rgb(56 189 248 / 0.25);
}

/* Intentional duplicate declaration to test duplicate declaration detection (FR-P3) */
.brand-title {
  color: #ffffff;
  color: var(--tso-text-primary);
}

/* Intentional unused CSS class to test cross-file connection warnings (FR-P5d) */
.unused-legacy-widget {
  background-color: #ff0055;
  color: #ffffff;
  padding: 1rem;
}

/* At-rule: Keyframes Animation (FR-P3) */
@keyframes pulseIndicator {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.96);
  }
}

/* At-rule: Media Queries (FR-P3) */
@media (max-width: 768px) {
  .nav-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  .nav-links {
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 1024px) {
  .qa-form {
    grid-template-columns: 1fr 1fr;
  }
  .form-actions {
    grid-column: span 2;
  }
}
`;

export const SAMPLE_JS = `/**
 * Agentic-mesh Client Application Script
 * Demonstrates AST symbols, classes, event listeners, DOM queries,
 * network calls, and cross-file connection validation.
 */

// Module configuration constants (FR-P4)
const API_BASE_ENDPOINT = "https://staging.agentic-mesh.io/api/v1";
const DEFAULT_HEALING_TIMEOUT_MS = 8000;
const RETRY_ATTEMPTS_LIMIT = 3;

/**
 * State container for live execution telemetry.
 */
class ExecutionTelemetryManager {
  constructor(suiteName, targetUrl) {
    this.suiteName = suiteName;
    this.targetUrl = targetUrl;
    this.status = "idle";
    this.metrics = [];
  }

  /**
   * Records a discrete latency timestamp.
   */
  recordStepLatency(stepIndex, durationMs) {
    this.metrics.push({ stepIndex, durationMs, timestamp: Date.now() });
  }

  /**
   * Computes average locator resolution time.
   */
  getAverageResolutionTime() {
    if (this.metrics.length === 0) return 0;
    const sum = this.metrics.reduce((acc, m) => acc + m.durationMs, 0);
    return Math.round(sum / this.metrics.length);
  }

  /**
   * Sets current execution lifecycle state.
   */
  setLifecycleState(newState) {
    this.status = newState;
    console.info(\`[Telemetry] Transitioned to state: \${newState}\`);
  }
}

/**
 * Dispatches test execution request to backend API (FR-P4).
 */
async function triggerAutomatedRun(suiteName, targetUrl, environment) {
  const payload = {
    suite: suiteName,
    url: targetUrl,
    env: environment,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch("https://staging.agentic-mesh.io/api/v1/runs/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(\`Execution request failed with status: \${response.status}\`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Failed to trigger automated test run:", err);
    return null;
  }
}

/**
 * Arrow function to format human-readable duration strings (FR-P4).
 */
const formatDuration = (milliseconds) => {
  if (milliseconds < 1000) return \`\${milliseconds}ms\`;
  const seconds = (milliseconds / 1000).toFixed(1);
  return \`\${seconds}s\`;
};

/**
 * Arrow function for locator similarity scoring.
 */
const computeLocatorSimilarity = (selectorA, selectorB) => {
  if (selectorA === selectorB) return 1.0;
  const tokensA = new Set(selectorA.split(/[\\s>+~.]+/));
  const tokensB = new Set(selectorB.split(/[\\s>+~.]+/));
  const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)));
  return intersection.size / Math.max(tokensA.size, tokensB.size);
};

// DOM Query Bindings and Event Listeners (FR-P4, FR-P5)
document.addEventListener("DOMContentLoaded", () => {
  console.log("Initializing Agentic-mesh Client DOM Controller...");

  // DOM Queries matching elements present in sample.html
  const runForm = document.getElementById("new-run-form");
  const loginButton = document.getElementById("login-btn");
  const suiteInput = document.getElementById("suite-name");
  const targetUrlInput = document.getElementById("target-url");
  const envSelect = document.getElementById("environment-select");
  const testItems = document.querySelectorAll(".item");
  const themeToggle = document.querySelector("#theme-toggle-btn");

  // Intentional unmatched DOM query to test connection warnings (FR-P5d)
  const nonExistentModal = document.querySelector("#non-existent-modal");
  if (nonExistentModal) {
    nonExistentModal.classList.add("visible");
  }

  // Event listener on Form Submit
  if (runForm) {
    runForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const suite = suiteInput ? suiteInput.value.trim() : "default-suite";
      const url = targetUrlInput ? targetUrlInput.value.trim() : "http://localhost:3000";
      const env = envSelect ? envSelect.value : "staging";

      console.log(\`Starting execution for suite '\${suite}' on environment '\${env}'\`);

      if (loginButton) {
        loginButton.setAttribute("disabled", "true");
        loginButton.textContent = "Executing...";
      }

      const telemetry = new ExecutionTelemetryManager(suite, url);
      telemetry.setLifecycleState("running");

      const result = await triggerAutomatedRun(suite, url, env);

      if (loginButton) {
        loginButton.removeAttribute("disabled");
        loginButton.textContent = "Trigger Execution";
      }

      if (result) {
        telemetry.setLifecycleState("completed");
        console.log("Run completed successfully:", result);
      } else {
        telemetry.setLifecycleState("failed");
      }
    });
  }

  // Event listener on Theme Toggle
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("theme-dark");
      localStorage.setItem("sentinel-theme", isDark ? "dark" : "light");
    });
  }

  // Iterate test items
  if (testItems) {
    testItems.forEach((item, index) => {
      item.addEventListener("click", () => {
        console.log(\`Clicked test item index: \${index}\`);
      });
    });
  }
});

// Export helper API
export { ExecutionTelemetryManager, triggerAutomatedRun, formatDuration, computeLocatorSimilarity };
`;
