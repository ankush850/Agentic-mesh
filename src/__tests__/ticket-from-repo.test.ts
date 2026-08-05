import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  generateTicketFromAppModel,
  groundCriterion,
  generateHeuristicCriteriaFromAppModel,
  computeTicketHash,
  getNextFreeTicketKey,
  findExistingTicketByHash,
} from "../jira/ticketFromRepo";
import { AppModel } from "../repo/astParser";
import { TicketSchema } from "../types";
import { generateHeuristicTestCases } from "../generator/criteriaToSteps";

describe("ticketFromRepo", () => {
  let tempGenDir: string;

  const mockAppModel: AppModel = {
    repoPath: "/test/my-shop",
    totalFilesParsed: 2,
    parseErrors: [],
    components: [],
    pages: [
      {
        file: "index.html",
        routeOrFile: "index.html",
        route: "/",
        title: "Product Store",
        forms: [
          {
            id: "search-form",
            method: "GET",
            sourceFile: "index.html",
            startLine: 15,
            fields: [
              {
                tag: "input",
                id: "search-query",
                name: "query",
                type: "text",
                placeholder: "Search items",
                required: false,
                sourceFingerprint: "fp-search",
              },
            ],
            submitButtonText: "Search",
            submitSelector: "#search-btn",
          },
        ],
        interactiveElements: [
          {
            tag: "button",
            id: "search-btn",
            visibleText: "Search",
            role: "button",
            sourceFile: "index.html",
            startLine: 18,
            treePosition: "body > form > button",
            sourceFingerprint: "fp-btn1",
            eventHandlers: ["onclick"],
          },
          {
            tag: "button",
            id: "cart-btn",
            dataTestId: "view-cart",
            visibleText: "View Cart",
            role: "button",
            sourceFile: "index.html",
            startLine: 25,
            treePosition: "body > header > button",
            sourceFingerprint: "fp-btn2",
            eventHandlers: ["onclick"],
          },
        ],
        links: [
          {
            text: "About Us",
            href: "/about.html",
            sourceFile: "index.html",
            startLine: 8,
          },
        ],
        conditionalRenderHints: [],
      },
    ],
  };

  beforeEach(() => {
    tempGenDir = fs.mkdtempSync(path.join(os.tmpdir(), "sqa-gen-tickets-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempGenDir)) {
      fs.rmSync(tempGenDir, { recursive: true, force: true });
    }
  });

  describe("groundCriterion", () => {
    it("accepts criteria referencing real elements in the AppModel", () => {
      const crit = "Given the store, when the user clicks 'Search' button, items should appear";
      const evidence = groundCriterion(crit, 0, mockAppModel);

      expect(evidence).not.toBeNull();
      expect(evidence?.elements.some((e) => e.includes("Search"))).toBe(true);
      expect(evidence?.source).toContain("index.html");
    });

    it("drops hallucinated criteria referencing non-existent elements", () => {
      const crit = "Given the checkout page, when the user enters credit card 4111 and clicks Pay Now, payment succeeds";
      const evidence = groundCriterion(crit, 0, mockAppModel);

      expect(evidence).toBeNull();
    });
  });

  describe("generateHeuristicCriteriaFromAppModel", () => {
    it("generates Gherkin scenarios from forms, buttons, and links with evidence", () => {
      const result = generateHeuristicCriteriaFromAppModel(mockAppModel, 5);

      expect(result.criteria.length).toBeGreaterThanOrEqual(2);
      expect(result.criteria[0]).toMatch(/^Given /);
      expect(result.evidence.length).toBe(result.criteria.length);
    });
  });

  describe("computeTicketHash and de-duplication", () => {
    it("produces deterministic hash", () => {
      const h1 = computeTicketHash("Summary", ["Crit 1", "Crit 2"]);
      const h2 = computeTicketHash("Summary", ["Crit 1", "Crit 2"]);
      expect(h1).toBe(h2);

      const h3 = computeTicketHash("Summary", ["Different"]);
      expect(h1).not.toBe(h3);
    });
  });

  describe("generateTicketFromAppModel", () => {
    it("generates a Zod-validated ticket in offline heuristic mode when no LLM is configured", async () => {
      const ticket = await generateTicketFromAppModel({
        appModel: mockAppModel,
        fixturesDir: tempGenDir,
        dryRun: true,
      });

      expect(ticket.key).toMatch(/^SQA-\d+$/);
      expect(ticket.summary).toBeDefined();
      expect(ticket.description).toContain("Automated verification suite");
      expect(ticket.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(ticket.labels).toEqual(["agentic-mesh-generated"]);
      expect(ticket.evidence.length).toBe(ticket.acceptanceCriteria.length);
      expect(ticket.reviewNotice).toBe("auto-generated, needs human review");

      // Verify file was written to fixtures/generated-tickets
      const savedFile = path.join(tempGenDir, `${ticket.key}.json`);
      expect(fs.existsSync(savedFile)).toBe(true);

      // Verify compatibility with existing TicketSchema
      const validatedTicket = TicketSchema.parse(ticket);
      expect(validatedTicket.key).toBe(ticket.key);

      // Verify feeding into existing test generator
      const testCases = generateHeuristicTestCases(validatedTicket);
      expect(testCases.length).toBe(ticket.acceptanceCriteria.length);
    });

    it("de-duplicates and returns existing ticket if content matches", async () => {
      const ticket1 = await generateTicketFromAppModel({
        appModel: mockAppModel,
        fixturesDir: tempGenDir,
        dryRun: true,
      });

      const ticket2 = await generateTicketFromAppModel({
        appModel: mockAppModel,
        fixturesDir: tempGenDir,
        dryRun: true,
      });

      expect(ticket2.key).toBe(ticket1.key);
      expect(ticket2.contentHash).toBe(ticket1.contentHash);
    });
  });
});

