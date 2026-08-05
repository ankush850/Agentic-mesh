import type { Page } from "playwright";
import { ElementCandidate } from "../types";
import { AppModel, InteractiveElement } from "./astParser";
import { logger } from "../logger";

export interface AstHealingResult {
  newLocator: string;
  confidence: number;
  reason: string;
  diff: {
    oldLocator: string;
    newLocator: string;
    changedAttribute?: string;
  };
}

export interface AstHealingParams {
  page: Page;
  oldLocator: string;
  appModel: AppModel;
  candidates: ElementCandidate[];
}

/**
 * Extracts selector parts (tag, id, testid, text) from a Playwright locator string.
 */
function extractLocatorClues(locator: string): {
  tag?: string;
  id?: string;
  testid?: string;
  text?: string;
} {
  const clean = locator.trim();
  const idMatch = clean.match(/#([a-zA-Z0-9_-]+)/) || clean.match(/\[id=['"]?([^'"\]]+)['"]?\]/);
  const testidMatch = clean.match(/\[data-testid=['"]?([^'"\]]+)['"]?\]/);
  const textMatch = clean.match(/:has-text\(['"]?([^'"]+)['"]?\)/);
  const tagMatch = clean.match(/^([a-zA-Z0-9]+)/);

  return {
    id: idMatch ? idMatch[1] : undefined,
    testid: testidMatch ? testidMatch[1] : undefined,
    text: textMatch ? textMatch[1] : undefined,
    tag: tagMatch && !clean.startsWith("#") && !clean.startsWith("[") && !clean.startsWith(".") ? tagMatch[1].toLowerCase() : undefined,
  };
}

/**
 * Tier 0 Deterministic Healing:
 * Compares the broken locator against the static AppModel to find structural matches
 * when element attributes (id, testid, text, class) have changed.
 * Guarantees that any healed locator resolves to EXACTLY ONE live element on the page.
 */
export async function tryAstDeterministicHealing(
  params: AstHealingParams
): Promise<AstHealingResult | null> {
  const { page, oldLocator, appModel, candidates } = params;
  if (!appModel || candidates.length === 0) return null;

  const clues = extractLocatorClues(oldLocator);

  // 1. Locate the element in the parsed AppModel
  const allElements = appModel.interactiveElements?.length
    ? appModel.interactiveElements
    : appModel.pages?.flatMap((p) => p.interactiveElements || []) || [];

  let modelElement: InteractiveElement | undefined;

  if (clues.id) {
    modelElement = allElements.find((e) => e.id === clues.id);
  }
  if (!modelElement && clues.testid) {
    modelElement = allElements.find((e) => e.dataTestId === clues.testid);
  }
  if (!modelElement && clues.text) {
    modelElement = allElements.find((e) => {
      const t = e.visibleText || e.text;
      return t && t.toLowerCase().includes(clues.text!.toLowerCase());
    });
  }
  if (!modelElement && clues.tag) {
    modelElement = allElements.find((e) => e.tag.toLowerCase() === clues.tag);
  }

  // 2. Scan live DOM candidates for structural match
  for (const candidate of candidates) {
    const candTag = candidate.tag.toLowerCase();
    const candId = candidate.id;
    const candTestId = candidate.locator.includes("data-testid")
      ? candidate.locator.match(/data-testid=['"]?([^'"\]]+)/)?.[1]
      : undefined;

    // Check if structure matches
    let isMatch = false;
    let diffReason = "";

    if (modelElement) {
      const tagMatches = candTag === modelElement.tag.toLowerCase();
      const roleMatches = !modelElement.role || candidate.role === modelElement.role;
      const modelText = modelElement.visibleText || modelElement.text;
      const textMatches =
        modelText &&
        candidate.text &&
        (candidate.text.toLowerCase().includes(modelText.toLowerCase()) ||
          modelText.toLowerCase().includes(candidate.text.toLowerCase()));

      // Structural tag match with changed ID or testid
      if (tagMatches && roleMatches) {
        if (clues.id && candId && candId !== clues.id) {
          isMatch = true;
          diffReason = `id changed from "${clues.id}" to "${candId}"`;
        } else if (clues.testid && candTestId && candTestId !== clues.testid) {
          isMatch = true;
          diffReason = `data-testid changed from "${clues.testid}" to "${candTestId}"`;
        } else if (textMatches && (!clues.text || candidate.text !== clues.text)) {
          isMatch = true;
          diffReason = `label/text changed to "${candidate.text}"`;
        }
      }
    } else {
      // Direct heuristic structure match against candidate pool
      if (clues.id && candidate.locator.includes(clues.id)) {
        isMatch = true;
        diffReason = `matched candidate locator pattern "${candidate.locator}"`;
      }
    }

    if (isMatch) {
      const newLocator = candidate.locator;

      // RULE: Must resolve to EXACTLY ONE element on page
      try {
        const count = await page.locator(newLocator).count();
        if (count === 1) {
          const reason = modelElement
            ? `Tier 0 AST structure match (${modelElement.sourceFile}:${modelElement.startLine}): ${diffReason}`
            : `Tier 0 AST structure match: ${diffReason}`;

          logger.info(
            { oldLocator, newLocator, reason, confidence: 0.95 },
            "[TIER-0 AST HEALING] Found deterministic locator repair"
          );

          return {
            newLocator,
            confidence: 0.95,
            reason,
            diff: {
              oldLocator,
              newLocator,
              changedAttribute: diffReason,
            },
          };
        }
      } catch {
        // Locator error in count evaluation, skip candidate
      }
    }
  }

  return null;
}
