import { z } from "zod";
import { TestCase, TestCaseSchema, Ticket } from "../types";
import { generateJSON, getLLMStatus } from "../llm/provider";
import { logger } from "../logger";

const GeneratedTestsSchema = z.object({
  testCases: z.array(TestCaseSchema),
});

/**
 * Heuristic/rule-based test case generator used when LLM keys are absent or as a fallback.
 */
export function generateHeuristicTestCases(ticket: Ticket): TestCase[] {
  return ticket.acceptanceCriteria.map((criterion, idx) => {
    const id = `TC-${String(idx + 1).padStart(2, "0")}`;
    const lower = criterion.toLowerCase();

    // Extract credentials if present in criterion
    const emailMatch = criterion.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const userMatch = emailMatch ? [null, emailMatch[1]] : criterion.match(/username ['"]?([^'"\s]+)['"]?/i) || criterion.match(/user ['"]?([^'"\s]+)['"]?/i);
    const passMatch = criterion.match(/password\s+['"]?([^\s'"]+)['"]?/i);
    const username: string = (userMatch && userMatch[1]) ? userMatch[1] : "admin";
    const password: string = (passMatch && passMatch[1]) ? passMatch[1] : "password123";
    const userTarget = emailMatch || lower.includes("email") ? "#email" : "#username";
    const submitTarget = "#submitBtn";

    // Criterion 1: Valid Login
    if (!lower.includes("invalid") && (lower.includes("valid") || lower.includes("successful")) && lower.includes("login")) {
      const expectedOutcome = lower.includes("admin dashboard") ? "Admin Dashboard" : (lower.includes("welcome") ? "Welcome" : "Welcome, admin!");
      return {
        id,
        title: "Successful User Authentication",
        criterion,
        steps: [
          { description: "Navigate to base application URL", action: "navigate" },
          {
            description: `Fill ${userTarget === "#email" ? "email" : "username"} with '${username}'`,
            action: "fill",
            target: userTarget,
            value: username,
            data: { value: username },
          },
          {
            description: `Fill password with '${password}'`,
            action: "fill",
            target: "#password",
            value: password,
            data: { value: password },
          },
          {
            description: "Click the Login button",
            action: "click",
            target: submitTarget,
          },
        ],
        expectedOutcome,
      };
    }

    // Criterion 2: Invalid Login Error
    if (lower.includes("invalid") || lower.includes("error message") || lower.includes("wrongpass") || lower.includes("incorrect")) {
      const invalidUser = "wrong_" + username;
      const invalidPass = "wrong_" + password;

      return {
        id,
        title: "Login Failure Displays Error",
        criterion,
        steps: [
          { description: "Navigate to base application URL", action: "navigate" },
          {
            description: `Fill ${userTarget === "#email" ? "email" : "username"} with '${invalidUser}'`,
            action: "fill",
            target: userTarget,
            value: invalidUser,
            data: { value: invalidUser },
          },
          {
            description: `Fill password with '${invalidPass}'`,
            action: "fill",
            target: "#password",
            value: invalidPass,
            data: { value: invalidPass },
          },
          {
            description: "Click the Login button",
            action: "click",
            target: submitTarget,
          },
        ],
        expectedOutcome: "Invalid",
      };
    }

    // Criterion 3: Add Item / Task
    if (lower.includes("add") || lower.includes("task") || lower.includes("item") || lower.includes("todo")) {
      const taskMatch = criterion.match(/['"]([^'"]+)['"]\s+into/i) || criterion.match(/type\s+['"]([^'"]+)['"]/i);
      const taskText = taskMatch ? taskMatch[1] : "Deploy Agentic-mesh";

      return {
        id,
        title: "Add Task to List",
        criterion,
        steps: [
          { description: "Navigate to base application URL", action: "navigate" },
          {
            description: "Fill username with 'admin'",
            action: "fill",
            target: "#username",
            value: "admin",
            data: { value: "admin" },
          },
          {
            description: "Fill password with 'password123'",
            action: "fill",
            target: "#password",
            value: "password123",
            data: { value: "password123" },
          },
          {
            description: "Click the Login button",
            action: "click",
            target: "#login-btn",
          },
          {
            description: `Fill new task input with '${taskText}'`,
            action: "fill",
            target: "#todo-input",
            value: taskText,
            data: { value: taskText },
          },
          {
            description: "Click the Add Task button",
            action: "click",
            target: "#add-todo-btn",
          },
        ],
        expectedOutcome: taskText,
      };
    }

    // Criterion 4: Logout
    if (lower.includes("logout") || lower.includes("sign out") || lower.includes("logged out")) {
      return {
        id,
        title: "User Logout",
        criterion,
        steps: [
          { description: "Navigate to base application URL", action: "navigate" },
          {
            description: `Fill ${userTarget === "#email" ? "email" : "username"} with '${username}'`,
            action: "fill",
            target: userTarget,
            value: username,
            data: { value: username },
          },
          {
            description: `Fill password with '${password}'`,
            action: "fill",
            target: "#password",
            value: password,
            data: { value: password },
          },
          {
            description: "Click the Login button",
            action: "click",
            target: submitTarget,
          },
          {
            description: "Click the Logout button",
            action: "click",
            target: "#logoutBtn",
          },
        ],
        expectedOutcome: "Sign In",
      };
    }

    // Generic fallback for any arbitrary criterion
    return {
      id,
      title: `Verification for Criterion ${idx + 1}`,
      criterion,
      steps: [
        { description: "Navigate to base application URL", action: "navigate" },
        { description: `Execute steps to verify: ${criterion}` },
      ],
      expectedOutcome: criterion,
    };
  });
}

/**
 * Converts Jira Ticket acceptance criteria into executable TestCases using LLM,
 * with graceful fallback to heuristic generator.
 */
export async function criteriaToSteps(ticket: Ticket): Promise<TestCase[]> {
  logger.info({ key: ticket.key, criteriaCount: ticket.acceptanceCriteria.length }, "Generating test cases from acceptance criteria...");

  const status = getLLMStatus();

  if (!status.groqAvailable && !status.geminiAvailable) {
    logger.info("No LLM keys configured; using smart rule-based test generator.");
    return generateHeuristicTestCases(ticket);
  }

  const prompt = `
You are Agentic-mesh's test generation engine. Convert the following Jira ticket acceptance criteria into automated Playwright test cases.

Ticket: ${ticket.key} - ${ticket.title}
Description: ${ticket.description}

Acceptance Criteria:
${ticket.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Requirements:
- Generate exactly one test case for each acceptance criterion.
- Each test case runs in ISOLATION starting from the base URL. A "navigate"
  step can only reach the landing page, never a protected screen.
- Only add a login/authentication sequence when the criteria genuinely require
  it: i.e. a criterion presumes a signed-in state ("Given the user is on the
  dashboard", "when logged in", "after adding an item") AND real credentials
  (a username/password) appear somewhere in this ticket's criteria. In that
  case prepend the concrete login steps using THOSE exact credentials.
- Otherwise DO NOT invent a login step or any credentials that are not present
  in the ticket. If the ticket has no login, start directly from the page the
  criterion describes.
- Each test case must have:
  - "id": string like "TC-01", "TC-02", etc.
  - "title": clear short title
  - "criterion": the original criterion verbatim
  - "steps": array of sequential interaction steps. Each step must have:
    - "description": clear natural-language step (e.g. "Fill username with 'admin'", "Click the Login button")
    - "action": optional verb like "navigate", "click", "fill"
    - "target": optional selector hint or description
    - "value": optional input string value
    - "data": optional { value: string }
  - "expectedOutcome": the EXACT literal text that will be visible on the page when
    the criterion passes (e.g. "Sum: 12", "Bread", "Your list is empty.",
    "Invalid username or password"). Do NOT write a sentence describing the
    result — provide only the raw on-screen string the assertion should find.

Return JSON strictly matching this format:
{
  "testCases": [
    {
      "id": "TC-01",
      "title": "...",
      "criterion": "...",
      "steps": [
        { "description": "...", "action": "...", "target": "...", "value": "..." }
      ],
      "expectedOutcome": "..."
    }
  ]
}
`;

  try {
    const result = await generateJSON(prompt, GeneratedTestsSchema, {
      systemPrompt: "You are an expert QA automation engineer who writes precise, deterministic browser test steps.",
      temperature: 0.1,
    });
    logger.info({ modelUsed: result.modelUsed, testCasesCount: result.data.testCases.length }, "Test cases generated successfully via LLM.");
    return result.data.testCases;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "LLM test generation failed or timed out. Falling back to heuristic generator.");
    return generateHeuristicTestCases(ticket);
  }
}
