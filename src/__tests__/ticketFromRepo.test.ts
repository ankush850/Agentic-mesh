import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  generateTicketFromAppModel,
  getNextFreeTicketKey,
  computeTicketHash,
  groundCriterion,
} from "../jira/ticketFromRepo";
import { AppModel } from "../repo/astParser";

describe("ticketFromRepo", () => {
  const tmpGenDir = path.join(os.tmpdir(), "agentic-mesh-gen-tickets-" + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tmpGenDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpGenDir)) {
      fs.rmSync(tmpGenDir, { recursive: true, force: true });
    }
  });

  const sampleAppModel: AppModel = {
    repoPath: "/test/shopping-app",
    pages: [{ route: "/", file: "index.html", title: "Shopping Cart" }],
    components: [],
    interactiveElements: [
      {
        tag: "input",
        id: "item-input",
        name: "itemName",
        placeholder: "Enter item",
        sourceFile: "index.html",
        startLine: 12,
        endLine: 12,
        sourceFingerprint: "fp-item-input",
        eventHandlers: [],
        formId: "add-item-form",
      },
      {
        tag: "button",
        id: "add-item-btn",
        text: "Add Item",
        sourceFile: "index.html",
        startLine: 14,
        endLine: 14,
        sourceFingerprint: "fp-add-btn",
        eventHandlers: ["onClick"],
        formId: "add-item-form",
      },
      {
        tag: "a",
        href: "/checkout",
        text: "Checkout Now",
        sourceFile: "index.html",
        startLine: 20,
        endLine: 20,
        sourceFingerprint: "fp-link-checkout",
        eventHandlers: [],
      },
    ],
    forms: [
      {
        id: "add-item-form",
        action: "/cart/add",
        method: "POST",
        sourceFile: "index.html",
        startLine: 10,
        endLine: 15,
        fields: [
          {
            tag: "input",
            id: "item-input",
            name: "itemName",
            placeholder: "Enter item",
            required: true,
            sourceFile: "index.html",
            line: 12,
          },
        ],
      },
    ],
    navigationLinks: [
      { href: "/checkout", text: "Checkout Now", sourceFile: "index.html", line: 20 },
    ],
    conditionalRenderHints: [],
    stats: {
      fileCount: 1,
      elementCount: 3,
      formCount: 1,
      componentCount: 0,
      routeCount: 1,
    },
  };

  it("determines next free ticket key monotonically", () => {
    const key = getNextFreeTicketKey("SQA", tmpGenDir);
    expect(key).toMatch(/^SQA-\d+$/);
    const num = parseInt(key.split("-")[1], 10);
    expect(num).toBeGreaterThanOrEqual(11); // demo-tickets has SQA-11
  });

  it("grounds valid criteria referencing elements and drops hallucinated criteria", () => {
    // Valid: references "item-input" and "Add Item"
    const validCrit = "Given the shopping page, when the user enters 'Milk' into item-input and clicks Add Item, the cart updates";
    const evidence = groundCriterion(validCrit, 0, sampleAppModel);
    expect(evidence).not.toBeNull();
    expect(evidence?.elements.length).toBeGreaterThan(0);
    expect(evidence?.source).toBe("index.html:12");

    // Hallucinated: references nonexistent elements
    const hallucinatedCrit = "Given the payment page, when the user enters credit card 4111 and clicks Process Wire Transfer, balance updates";
    const invalidEvidence = groundCriterion(hallucinatedCrit, 1, sampleAppModel);
    expect(invalidEvidence).toBeNull();
  });

  it("generates grounded ticket via offline heuristic fallback without LLM", async () => {
    const ticket = await generateTicketFromAppModel({
      appModel: sampleAppModel,
      fixturesDir: tmpGenDir,
      dryRun: true,
    });

    expect(ticket.key).toMatch(/^SQA-\d+$/);
    expect(ticket.summary).toBeDefined();
    expect(ticket.description).toContain("index.html");
    expect(ticket.labels).toEqual(["agentic-mesh-generated"]);
    expect(ticket.reviewNotice).toBe("auto-generated, needs human review");
    expect(ticket.acceptanceCriteria.length).toBeGreaterThan(0);
    expect(ticket.evidence.length).toBe(ticket.acceptanceCriteria.length);

    // Verifies saving to fixture directory
    const savedPath = path.join(tmpGenDir, `${ticket.key}.json`);
    expect(fs.existsSync(savedPath)).toBe(true);
  });

  it("deduplicates identical tickets by hash", async () => {
    const ticket1 = await generateTicketFromAppModel({
      appModel: sampleAppModel,
      fixturesDir: tmpGenDir,
      dryRun: true,
    });

    const ticket2 = await generateTicketFromAppModel({
      appModel: sampleAppModel,
      fixturesDir: tmpGenDir,
      dryRun: true,
    });

    // Same content produces same ticket key rather than creating a duplicate
    expect(ticket2.key).toBe(ticket1.key);
    expect(ticket2.contentHash).toBe(ticket1.contentHash);
  });
});
