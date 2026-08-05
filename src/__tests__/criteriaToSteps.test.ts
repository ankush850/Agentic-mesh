import { describe, it, expect } from "vitest";
import { generateHeuristicTestCases } from "../generator/criteriaToSteps";
import { TestCaseSchema, Ticket } from "../types";

describe("criteriaToSteps Test Generator", () => {
  const sampleTicket: Ticket = {
    key: "QA-101",
    title: "User Auth and Todo Flow",
    description: "Flow test ticket",
    acceptanceCriteria: [
      "Given the user is on login page, when they enter valid username 'admin' and password 'password123' and click Login, they should see 'Welcome, admin!'",
      "Given the user enters invalid credentials 'admin' and 'wrongpass', they should see error message 'Invalid username or password'",
      "Given the user is logged in, when they type 'Deploy Agentic-mesh' into task input and click Add Task, the item should appear",
      "Given the user is on dashboard, when they click Logout, they should see 'Sign In'",
    ],
  };

  it("generates valid TestCases conforming to TestCaseSchema", () => {
    const testCases = generateHeuristicTestCases(sampleTicket);

    expect(testCases).toHaveLength(4);

    for (const tc of testCases) {
      const parsed = TestCaseSchema.safeParse(tc);
      expect(parsed.success).toBe(true);
      expect(tc.steps.length).toBeGreaterThan(0);
      expect(tc.expectedOutcome).toBeTruthy();
    }
  });

  it("extracts credentials and target inputs properly", () => {
    const testCases = generateHeuristicTestCases(sampleTicket);
    const validLogin = testCases[0];

    const userStep = validLogin.steps.find((s) => s.description.includes("admin"));
    expect(userStep).toBeDefined();
    expect(userStep?.value).toBe("admin");

    const passStep = validLogin.steps.find((s) => s.description.includes("password123"));
    expect(passStep).toBeDefined();
    expect(passStep?.value).toBe("password123");
  });
});

