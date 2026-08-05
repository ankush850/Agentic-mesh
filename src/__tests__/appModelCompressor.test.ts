import { describe, it, expect } from "vitest";
import { compressAppModel } from "../repo/appModelCompressor";
import { AppModel } from "../repo/astParser";

describe("appModelCompressor", () => {
  const mockModel: AppModel = {
    repoPath: "/mock/repo",
    pages: [
      { route: "/", title: "Home", file: "index.html" },
      { route: "/tasks", title: "Tasks", file: "tasks.html" },
    ],
    components: [
      { name: "Header", file: "index.html", startLine: 1, endLine: 10, props: [] },
    ],
    interactiveElements: [
      {
        tag: "button",
        id: "submit-btn",
        dataTestId: "submit-btn",
        text: "Submit Task",
        eventHandlers: ["onClick"],
        sourceFile: "index.html",
        startLine: 12,
        endLine: 12,
        sourceFingerprint: "fp-btn-1",
      },
      {
        tag: "input",
        id: "task-name",
        type: "text",
        placeholder: "Enter task",
        eventHandlers: ["onChange"],
        sourceFile: "tasks.html",
        startLine: 5,
        endLine: 5,
        sourceFingerprint: "fp-input-1",
      },
    ],
    forms: [
      {
        id: "task-form",
        action: "/submit",
        method: "POST",
        sourceFile: "tasks.html",
        startLine: 4,
        endLine: 8,
        fields: [
          {
            tag: "input",
            id: "task-name",
            type: "text",
            required: true,
            sourceFile: "tasks.html",
            line: 5,
          },
        ],
      },
    ],
    navigationLinks: [
      { href: "/tasks", text: "Go to Tasks", sourceFile: "index.html", line: 8 },
    ],
    conditionalRenderHints: [],
    stats: {
      fileCount: 2,
      elementCount: 2,
      formCount: 1,
      componentCount: 1,
      routeCount: 2,
    },
  };

  it("compresses AppModel into combined context with token savings stats", () => {
    const compressed = compressAppModel(mockModel);

    expect(compressed.optimizedContext).toContain("AGENTIC-MESH TREE-SITTER OPTIMIZED CODEBASE CONTEXT");
    expect(compressed.optimizedContext).toContain("PROJECT SKELETONS");
    expect(compressed.pages.length).toBe(2);

    expect(compressed.stats.beforeTokens).toBeGreaterThan(0);
    expect(compressed.stats.afterTokens).toBeGreaterThan(0);
    expect(compressed.stats.savingsPercent).toBeDefined();

    const homePage = compressed.pages.find((p) => p.file === "index.html");
    expect(homePage).toBeDefined();
    expect(homePage?.optimizedText).toContain("button#submit-btn");
  });

  it("supports focusPage option to chunk specifically for a target view", () => {
    const compressed = compressAppModel(mockModel, { focusPage: "tasks" });
    expect(compressed.pages.length).toBe(1);
    expect(compressed.pages[0].file).toBe("tasks.html");
  });
});
