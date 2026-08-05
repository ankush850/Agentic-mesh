import { describe, it, expect, vi } from "vitest";
import { tryAstDeterministicHealing } from "../repo/astHealingHints";
import { AppModel } from "../repo/astParser";
import { ElementCandidate } from "../types";

describe("astHealingHints (Tier 0 Healing)", () => {
  const mockAppModel: AppModel = {
    repoPath: "/app",
    totalFilesParsed: 1,
    parseErrors: [],
    components: [],
    pages: [
      {
        file: "login.html",
        routeOrFile: "login.html",
        route: "/login",
        interactiveElements: [
          {
            tag: "button",
            id: "old-login-btn",
            dataTestId: "old-login-testid",
            visibleText: "Log In",
            role: "button",
            sourceFile: "login.html",
            startLine: 12,
            treePosition: "body > form > button",
            sourceFingerprint: "fingerprint-btn",
            eventHandlers: ["onclick"],
          },
        ],
        forms: [],
        links: [],
        conditionalRenderHints: [],
      },
    ],
  };

  it("deterministically heals when element ID changed in live DOM", async () => {
    const candidates: ElementCandidate[] = [
      {
        tag: "button",
        id: "new-login-btn",
        text: "Log In",
        role: "button",
        locator: "#new-login-btn",
      },
    ];

    // Mock page with count === 1
    const mockPage = {
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(1),
      }),
    };

    const repair = await tryAstDeterministicHealing({
      page: mockPage as any,
      oldLocator: "#old-login-btn",
      appModel: mockAppModel,
      candidates,
    });

    expect(repair).not.toBeNull();
    expect(repair?.newLocator).toBe("#new-login-btn");
    expect(repair?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(repair?.reason).toContain("Tier 0 AST structure match");
    expect(repair?.reason).toContain('id changed from "old-login-btn" to "new-login-btn"');
    expect(repair?.diff.oldLocator).toBe("#old-login-btn");
    expect(repair?.diff.newLocator).toBe("#new-login-btn");
  });

  it("deterministically heals when data-testid changed in live DOM", async () => {
    const candidates: ElementCandidate[] = [
      {
        tag: "button",
        id: "any-btn",
        text: "Log In",
        role: "button",
        locator: '[data-testid="new-login-testid"]',
      },
    ];

    const mockPage = {
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(1),
      }),
    };

    const repair = await tryAstDeterministicHealing({
      page: mockPage as any,
      oldLocator: '[data-testid="old-login-testid"]',
      appModel: mockAppModel,
      candidates,
    });

    expect(repair).not.toBeNull();
    expect(repair?.newLocator).toBe('[data-testid="new-login-testid"]');
    expect(repair?.reason).toContain("data-testid changed");
  });

  it("rejects candidate if it resolves to multiple elements (must resolve to exactly one)", async () => {
    const candidates: ElementCandidate[] = [
      {
        tag: "button",
        id: "shared-btn",
        locator: ".shared-btn",
      },
    ];

    // Mock page returning count 2 (ambiguous)
    const mockPage = {
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(2),
      }),
    };

    const repair = await tryAstDeterministicHealing({
      page: mockPage as any,
      oldLocator: "#old-login-btn",
      appModel: mockAppModel,
      candidates,
    });

    expect(repair).toBeNull();
  });

  it("returns null if no structural candidate matches", async () => {
    const candidates: ElementCandidate[] = [
      {
        tag: "input",
        id: "search-input",
        locator: "#search-input",
      },
    ];

    const mockPage = {
      locator: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(1),
      }),
    };

    const repair = await tryAstDeterministicHealing({
      page: mockPage as any,
      oldLocator: "#old-login-btn",
      appModel: mockAppModel,
      candidates,
    });

    expect(repair).toBeNull();
  });
});

