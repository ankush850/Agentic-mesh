import * as fs from "fs";
import * as path from "path";
import { Version3Client } from "jira.js";
import { Ticket, TicketSchema } from "../types";
import { logger } from "../logger";

export interface JiraClientOptions {
  host?: string;
  email?: string;
  apiToken?: string;
  mockPath?: string;
  forceMock?: boolean;
  /**
   * When true, `fetchTicket` never falls back to the mock fixture and rethrows
   * Jira errors instead. Use this whenever a real ticket key was requested.
   */
  strict?: boolean;
}

/**
 * Recursively converts Atlassian Document Format (ADF) nodes into plain text.
 */
export function adfToPlainText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.type === "text") return node.text || "";

  if (Array.isArray(node.content)) {
    const joined = node.content.map(adfToPlainText).join(node.type === "bulletList" || node.type === "orderedList" ? "" : " ");
    if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem") {
      return joined.trim() + "\n";
    }
    return joined;
  }
  return "";
}

/**
 * Extracts acceptance criteria lines from plain text.
 */
export function extractAcceptanceCriteria(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const criteria: string[] = [];
  let inCriteriaSection = false;

  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (
      normalized.includes("acceptance criteria") ||
      normalized.startsWith("ac:") ||
      normalized.startsWith("acceptance:")
    ) {
      inCriteriaSection = true;
      continue;
    }

    if (inCriteriaSection) {
      // Check if we hit another section header like "Notes:", "Details:", "Expected Result", "Test Environment"
      const headerClean = line.replace(/:$/, "").trim().toLowerCase();
      if (
        headerClean === "expected result" ||
        headerClean === "expected results" ||
        headerClean === "test environment" ||
        headerClean === "notes" ||
        headerClean === "details" ||
        headerClean === "technical design" ||
        (/^[A-Z][a-zA-Z\s]{2,20}:?$/.test(line) &&
          !line.toLowerCase().includes("criteria") &&
          !line.toLowerCase().startsWith("given"))
      ) {
        inCriteriaSection = false;
        continue;
      }
      const cleaned = line.replace(/^[-*•\d.]+\s*/, "").trim();
      if (cleaned.length > 5) {
        criteria.push(cleaned);
      }
    } else {
      // Line looks like a standalone criterion (Given/When/Then or bullet)
      if (
        normalized.startsWith("given ") ||
        normalized.startsWith("- given ") ||
        normalized.startsWith("* given ") ||
        (normalized.includes("should ") && (line.startsWith("-") || line.startsWith("*")))
      ) {
        const cleaned = line.replace(/^[-*•\d.]+\s*/, "").trim();
        if (cleaned.length > 5) {
          criteria.push(cleaned);
        }
      }
    }
  }

  // If there are Gherkin criteria (starting with "Given "), prioritize them
  const gherkinOnly = criteria.filter((c) => c.toLowerCase().startsWith("given "));
  if (gherkinOnly.length > 0) {
    return gherkinOnly;
  }

  // If nothing matched specifically, extract any bullet points
  if (criteria.length === 0) {
    for (const line of lines) {
      if (/^[-*•]\s+/.test(line)) {
        const cleaned = line.replace(/^[-*•]\s*/, "").trim();
        if (cleaned.length > 10) {
          criteria.push(cleaned);
        }
      }
    }
  }

  return criteria;
}

/**
 * Loads mock ticket from fixtures/mock-ticket.json.
 */
export function loadMockTicket(customPath?: string): Ticket {
  const defaultPath = path.resolve(process.cwd(), "fixtures/mock-ticket.json");
  const targetPath = customPath ? path.resolve(process.cwd(), customPath) : defaultPath;

  if (!fs.existsSync(targetPath)) {
    // Also try looking in ./qa-agent/fixtures/mock-ticket.json
    const altPath = path.resolve(process.cwd(), "qa-agent/fixtures/mock-ticket.json");
    if (fs.existsSync(altPath)) {
      const content = fs.readFileSync(altPath, "utf-8");
      return TicketSchema.parse(JSON.parse(content));
    }
    throw new Error(`Mock ticket not found at path: ${targetPath}`);
  }

  const raw = fs.readFileSync(targetPath, "utf-8");
  const parsed = JSON.parse(raw);
  return TicketSchema.parse(parsed);
}

export class JiraClient {
  private client: Version3Client | null = null;
  private host: string;
  private email: string;
  private apiToken: string;
  private mockPath?: string;
  private forceMock: boolean;
  private strict: boolean;

  constructor(options: JiraClientOptions = {}) {
    this.host = options.host || process.env.JIRA_BASE_URL || "";
    this.email = options.email || process.env.JIRA_EMAIL || "";
    this.apiToken = options.apiToken || process.env.JIRA_API_TOKEN || "";
    this.mockPath = options.mockPath;
    this.forceMock = options.forceMock || false;
    this.strict = options.strict || false;

    if (this.host && this.email && this.apiToken && !this.forceMock) {
      try {
        this.client = new Version3Client({
          host: this.host.startsWith("http") ? this.host : `https://${this.host}`,
          authentication: {
            basic: {
              email: this.email,
              apiToken: this.apiToken,
            },
          },
        });
        logger.info({ host: this.host }, "Jira client initialized successfully.");
      } catch (err) {
        logger.warn({ err }, "Failed to initialize Jira client, will use mock fallback.");
        this.client = null;
      }
    }
  }

  public isConnected(): boolean {
    return this.client !== null && !this.forceMock;
  }

  /**
   * Fetches ticket from Jira Cloud API, with graceful fallback to mock ticket.
   */
  public async fetchTicket(key?: string): Promise<Ticket> {
    if (this.forceMock || !key) {
      if (this.strict) {
        throw new Error("Strict mode requires a ticket key and Jira credentials.");
      }
      logger.info("Using mock ticket source (Jira credentials not provided or --mock active).");
      return loadMockTicket(this.mockPath);
    }
    if (!this.client) {
      if (this.strict) {
        throw new Error("Jira credentials are not configured (JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN).");
      }
      logger.info("Using mock ticket source (Jira client unavailable).");
      return loadMockTicket(this.mockPath);
    }

    try {
      logger.info({ key }, "Fetching ticket from Jira REST API...");
      const issue = await this.client.issues.getIssue({
        issueIdOrKey: key,
        fields: ["summary", "description"],
      });

      const title = (issue.fields as any)?.summary || key;
      const rawDescription = (issue.fields as any)?.description;
      const descriptionText =
        typeof rawDescription === "string"
          ? rawDescription
          : adfToPlainText(rawDescription);

      let acceptanceCriteria = extractAcceptanceCriteria(descriptionText);

      // If description did not have parsed criteria, fall back to bulleted or split sentences
      if (acceptanceCriteria.length === 0) {
        acceptanceCriteria = [
          descriptionText.trim() || `Verify flow according to ticket ${key}`,
        ];
      }

      const ticket: Ticket = {
        key: issue.key || key,
        title,
        description: descriptionText.trim(),
        acceptanceCriteria,
      };

      return TicketSchema.parse(ticket);
    } catch (err) {
      if (this.strict) {
        logger.error({ err: (err as Error).message, key }, "Failed to fetch ticket from Jira API.");
        throw new Error(`Could not fetch Jira ticket ${key}: ${(err as Error).message}`);
      }
      logger.warn(
        { err: (err as Error).message, key },
        "Failed to fetch ticket from Jira API. Falling back to mock ticket."
      );
      const mock = loadMockTicket(this.mockPath);
      // Preserve key if provided
      return { ...mock, key };
    }
  }

  /**
   * Posts test run summary as a comment to the Jira ticket.
   */
  public async postResult(key: string, summary: string): Promise<boolean> {
    if (!this.client || this.forceMock) {
      logger.info({ key }, "Jira comment omitted (mock mode active). Summary preview:\n" + summary);
      return false;
    }

    try {
      await this.client.issueComments.addComment({
        issueIdOrKey: key,
        comment: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: summary,
                },
              ],
            },
          ],
        } as any,
      });
      logger.info({ key }, "Successfully posted test results to Jira ticket.");
      return true;
    } catch (err) {
      logger.error({ err, key }, "Failed to post comment to Jira ticket.");
      return false;
    }
  }
}

