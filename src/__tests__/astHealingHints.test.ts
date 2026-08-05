import { describe, it, expect, vi } from "vitest";
import { tryAstDeterministicHealing } from "../repo/astHealingHints";
import { AppModel } from "../repo/astParser";
import { ElementCandidate } from "../types";

describe("astHealingHints (Tier 0 Healing)", () => {
  const mockAppModel: AppModel = {
    repoPath: "/mock/repo",
    pages: [{ route: "/", file: "index.html" }],
    components: [],
    interactiveElements: [
      {
        tag: "button",
        id: "btn-submit-old",
        dataTestId: "submit-action",
        role: "button",
        text: "Submit Order",
        eventHandlers: ["onClick"],
        sourceFile: "index.html",
        startLine: 10,
        endLine: 10,
        sourceFingerprint: "fp-order-submit",
      },
    ],
    forms: [],
    navigationLinks: [],
    conditionalRenderHints: [],
    stats: {
      fileCount: 1,
      elementCount: 1,
      formCount: 0,
      componentCount: 0,
      routeCount: 1,
    },
  };

  it("repairs broken locator deterministically when id changed but element structure matches", async () => {
    const candidates: ElementCandidate[] = [
      {
        tag: "button",
        id: "btn-submit-new",
        role: "button",
        text: "Submit Order",
        locator: "#btn-submit-new",
      },
    ];

    // Mock Playwright Page: locator count === 1
    const mockPage: any = {
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(1),
      }),
    };

    const repair = await tryAstDeterministicHealing({
      page: mockPage,
      oldLocator: "#btn-submit-old",
      appModel: mockAppModel,
      candidates,
    });

    expect(repair).not.toBeNull();
    expect(repair?.newLocator).toBe("#btn-submit-new");
    expect(repair?.confidence).toBe(0.95);
    expect(repair?.reason).toContain("Tier 0 AST structure match");
    expect(repair?.reason).toContain("id changed");
    expect(repair?.diff.oldLocator).toBe("#btn-submit-old");
    expect(repair?.diff.newLocator).toBe("#btn-submit-new");
  });

  it("rejects candidate if healed locator does not resolve to exactly one element", async () => {
    const candidates: ElementCandidate[] = [
      {
        tag: "button",
        id: "btn-submit-new",
        role: "button",
        text: "Submit Order",
        locator: "button.submit",
      },
    ];

    // Mock Playwright Page: resolves to 2 elements (ambiguous)
    const mockPage: any = {
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(2),
      }),
    };

    const repair = await tryAstDeterministicHealing({
      page: mockPage,
      oldLocator: "#btn-submit-old",
      appModel: mockAppModel,
      candidates,
    });

    expect(repair).toBeNull();
  });

  it("returns null when no candidate matches structure", async () => {
    const candidates: ElementCandidate[] = [
      {
        tag: "input",
        id: "search-box",
        role: "textbox",
        locator: "#search-box",
      },
    ];

    const mockPage: any = {
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(1),
      }),
    };

    const repair = await tryAstDeterministicHealing({
      page: mockPage,
      oldLocator: "#nonexistent",
      appModel: mockAppModel,
      candidates,
    });

    expect(repair).toBeNull();
  });
});
