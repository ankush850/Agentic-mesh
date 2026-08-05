import { describe, it, expect } from "vitest";
import { adfToPlainText, extractAcceptanceCriteria, loadMockTicket } from "../jira/jiraClient";

describe("JiraClient and ADF Parser", () => {
  it("converts Atlassian Document Format (ADF) into text", () => {
    const mockAdf = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "As a user, I want to log in." }],
        },
        {
          type: "heading",
          content: [{ type: "text", text: "Acceptance Criteria:" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Given valid username and password, user sees dashboard" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const text = adfToPlainText(mockAdf);
    expect(text).toContain("As a user, I want to log in.");
    expect(text).toContain("Acceptance Criteria:");
    expect(text).toContain("Given valid username and password, user sees dashboard");
  });

  it("extracts acceptance criteria from plain text with sections or bullets", () => {
    const raw = `
User authentication story.

Acceptance Criteria:
- Given valid user, login succeeds
- Given invalid user, error shows

Notes:
Deploy to staging first.
`;
    const criteria = extractAcceptanceCriteria(raw);
    expect(criteria).toHaveLength(2);
    expect(criteria[0]).toContain("Given valid user");
    expect(criteria[1]).toContain("Given invalid user");
  });

  it("loads mock ticket fixture correctly", () => {
    const ticket = loadMockTicket();
    expect(ticket.key).toBe("QA-101");
    expect(ticket.acceptanceCriteria.length).toBeGreaterThanOrEqual(3);
  });
});

