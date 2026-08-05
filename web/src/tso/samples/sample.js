/**
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
    console.info(`[Telemetry] Transitioned to state: ${newState}`);
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
      throw new Error(`Execution request failed with status: ${response.status}`);
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
  if (milliseconds < 1000) return `${milliseconds}ms`;
  const seconds = (milliseconds / 1000).toFixed(1);
  return `${seconds}s`;
};

/**
 * Arrow function for locator similarity scoring.
 */
const computeLocatorSimilarity = (selectorA, selectorB) => {
  if (selectorA === selectorB) return 1.0;
  const tokensA = new Set(selectorA.split(/[\s>+~.]+/));
  const tokensB = new Set(selectorB.split(/[\s>+~.]+/));
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

      console.log(`Starting execution for suite '${suite}' on environment '${env}'`);

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
        console.log(`Clicked test item index: ${index}`);
      });
    });
  }
});

// Export helper API
export { ExecutionTelemetryManager, triggerAutomatedRun, formatDuration, computeLocatorSimilarity };
