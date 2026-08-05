import { describe, it, expect } from "vitest";
import * as path from "path";
import { parseRepository, computeSourceFingerprint } from "../repo/astParser";

describe("astParser", () => {
  it("generates deterministic sourceFingerprint", () => {
    const fp1 = computeSourceFingerprint({
      tag: "button",
      id: "submit-btn",
      text: "Submit",
      treePosition: 1,
    });
    const fp2 = computeSourceFingerprint({
      tag: "button",
      id: "submit-btn",
      text: "Submit",
      treePosition: 1,
    });
    const fpDiff = computeSourceFingerprint({
      tag: "button",
      id: "diff-btn",
      text: "Submit",
      treePosition: 1,
    });

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fpDiff);
    expect(fp1.length).toBe(16);
  });

  it("extracts comprehensive AppModel from static HTML fixture", async () => {
    const fixtureDir = path.resolve(process.cwd(), "fixtures/ast-samples/sample-site");
    const appModel = await parseRepository(fixtureDir);

    expect(appModel.repoPath).toBe(fixtureDir);
    expect(appModel.pages.length).toBeGreaterThan(0);
    expect(appModel.pages[0].title).toBe("Calculator & Task Tracker");

    // Interactive elements
    const elementTags = appModel.interactiveElements.map((e) => e.tag.toLowerCase());
    expect(elementTags).toContain("button");
    expect(elementTags).toContain("input");
    expect(elementTags).toContain("a");

    // Elements check
    const addBtn = appModel.interactiveElements.find((e) => e.id === "add-btn");
    expect(addBtn).toBeDefined();
    expect(addBtn?.dataTestId).toBe("calculate-button");
    expect(addBtn?.text).toBe("Add Numbers");
    expect(addBtn?.sourceFingerprint).toBeDefined();
    expect(addBtn?.formId).toBe("calc-form");

    // Forms and fields
    expect(appModel.forms.length).toBe(1);
    const form = appModel.forms[0];
    expect(form.id).toBe("calc-form");
    expect(form.action).toBe("/calculate");
    expect(form.method).toBe("POST");
    expect(form.fields.length).toBe(2);
    expect(form.fields[0].id).toBe("num1");
    expect(form.fields[0].required).toBe(true);

    // Navigation links
    const homeLink = appModel.navigationLinks.find((l) => l.href === "/home");
    expect(homeLink).toBeDefined();
    expect(homeLink?.text).toBe("Home");
  });

  it("extracts components, props, and conditional render hints from React TSX fixture", async () => {
    const fixtureDir = path.resolve(process.cwd(), "fixtures/ast-samples/sample-react");
    const appModel = await parseRepository(fixtureDir);

    // Components
    const compNames = appModel.components.map((c) => c.name);
    expect(compNames).toContain("Header");
    expect(compNames).toContain("TodoApp");

    const headerComp = appModel.components.find((c) => c.name === "Header");
    expect(headerComp).toBeDefined();
    expect(headerComp?.props.some((p) => p.name === "title")).toBe(true);

    // Interactive elements from JSX
    const todoInput = appModel.interactiveElements.find((e) => e.dataTestId === "todo-input");
    expect(todoInput).toBeDefined();
    expect(todoInput?.placeholder).toBe("What needs to be done?");
    expect(todoInput?.eventHandlers).toContain("onChange");

    const addBtn = appModel.interactiveElements.find((e) => e.dataTestId === "add-btn");
    expect(addBtn).toBeDefined();
    expect(addBtn?.text).toBe("Add");

    // Conditional render hints
    expect(appModel.conditionalRenderHints.length).toBeGreaterThan(0);
  });
});
