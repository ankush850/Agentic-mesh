/**
 * CSS Skeleton Extractor (FR-P3, FR-P6).
 * Groups rules by at-rule context, extracts selectors with specificity, declaration counts,
 * detects declared/used custom properties (--*), and flags duplicate selectors/declarations.
 */

import { Tree, SyntaxNode } from "./parse";
import type { SkeletonEntry } from "./extract-html";

export interface CssRuleDetails {
  context: string; // e.g. "top-level", "@media (max-width: 768px)", "@keyframes slide"
  selectors: Array<{
    text: string;
    specificity: [number, number, number];
    specificityLabel: string;
  }>;
  declarationCount: number;
  declarations: Array<{ property: string; value: string }>;
  isDuplicateSelector?: boolean;
  duplicateDeclarations?: string[];
}

export interface CssExtractionResult {
  entries: SkeletonEntry[];
  customPropertiesDeclared: string[];
  customPropertiesUsed: string[];
  rulesCount: number;
  atRulesCount: number;
  duplicateSelectors: string[];
  duplicateDeclarationsTotal: number;
}

/**
 * Calculates standard CSS specificity [IDs, Classes/Attrs/Pseudo-classes, Elements/Pseudo-elements].
 */
export function calculateSpecificity(selector: string): [number, number, number] {
  let a = 0; // IDs
  let b = 0; // Classes, attributes, pseudo-classes
  let c = 0; // Elements, pseudo-elements

  // Clean pseudo-class arguments like :not(...) or :is(...)
  const cleaned = selector.replace(/:not\(([^)]+)\)/g, "$1").replace(/:is\(([^)]+)\)/g, "$1");

  // Count IDs (#id)
  const idMatches = cleaned.match(/#[a-zA-Z0-9_-]+/g);
  if (idMatches) a += idMatches.length;

  // Count classes (.class)
  const classMatches = cleaned.match(/\.[a-zA-Z0-9_-]+/g);
  if (classMatches) b += classMatches.length;

  // Count attribute selectors ([attr=val])
  const attrMatches = cleaned.match(/\[[^\]]+\]/g);
  if (attrMatches) b += attrMatches.length;

  // Count pseudo-elements (::before)
  const pseudoElemMatches = cleaned.match(/::[a-zA-Z0-9_-]+/g);
  if (pseudoElemMatches) c += pseudoElemMatches.length;

  // Count pseudo-classes (:hover)
  const pseudoClassMatches = cleaned.replace(/::[a-zA-Z0-9_-]+/g, "").match(/:[a-zA-Z0-9_-]+/g);
  if (pseudoClassMatches) b += pseudoClassMatches.length;

  // Count element tags (div, span, etc.)
  // Remove matched ids, classes, attrs, pseudos, operators
  const stripped = cleaned
    .replace(/#[a-zA-Z0-9_-]+/g, " ")
    .replace(/\.[a-zA-Z0-9_-]+/g, " ")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/::?[a-zA-Z0-9_-]+/g, " ")
    .replace(/[>+~*]/g, " ")
    .trim();

  const words = stripped.split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (/^[a-zA-Z0-9_-]+$/.test(w)) {
      c++;
    }
  }

  return [a, b, c];
}

export function extractCssSkeleton(tree: Tree, fileName = "styles.css"): CssExtractionResult {
  const entries: SkeletonEntry[] = [];
  const customPropertiesDeclared = new Set<string>();
  const customPropertiesUsed = new Set<string>();
  const seenSelectors = new Map<string, number>();
  const duplicateSelectorsList: string[] = [];
  let duplicateDeclarationsTotal = 0;
  let rulesCount = 0;
  let atRulesCount = 0;

  // Find all custom properties used in tree text: var(--name)
  const varMatches = tree.text.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g);
  for (const m of varMatches) {
    customPropertiesUsed.add(m[1]);
  }

  function processRuleSet(node: SyntaxNode, context = "top-level", depth = 0) {
    rulesCount++;
    const selectorsNode = node.children.find((c) => c.type === "selectors");
    const rawSelectors = selectorsNode
      ? selectorsNode.children.map((c) => c.text.trim()).filter(Boolean)
      : [node.text.slice(0, node.text.indexOf("{")).trim()];

    const declarations = node.children
      .filter((c) => c.type === "declaration")
      .map((c) => {
        const p = c.children.find((k) => k.type === "property_name")?.text.trim() ?? "";
        const v = c.children.find((k) => k.type === "property_value")?.text.trim() ?? "";
        return { property: p, value: v };
      })
      .filter((d) => d.property.length > 0);

    // Track declared custom properties: --foo: bar
    for (const decl of declarations) {
      if (decl.property.startsWith("--")) {
        customPropertiesDeclared.add(decl.property);
      }
    }

    // Check duplicate declarations within this rule
    const seenProps = new Set<string>();
    const dupProps: string[] = [];
    for (const decl of declarations) {
      if (seenProps.has(decl.property)) {
        dupProps.push(decl.property);
        duplicateDeclarationsTotal++;
      } else {
        seenProps.add(decl.property);
      }
    }

    // Check duplicate selectors across stylesheet
    const selItems: Array<{
      text: string;
      specificity: [number, number, number];
      specificityLabel: string;
    }> = [];

    let isDuplicate = false;
    for (const sel of rawSelectors) {
      const spec = calculateSpecificity(sel);
      selItems.push({
        text: sel,
        specificity: spec,
        specificityLabel: `(${spec[0]},${spec[1]},${spec[2]})`,
      });

      const count = seenSelectors.get(sel) ?? 0;
      if (count > 0) {
        isDuplicate = true;
        if (!duplicateSelectorsList.includes(sel)) {
          duplicateSelectorsList.push(sel);
        }
      }
      seenSelectors.set(sel, count + 1);
    }

    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    const selectorSummary = rawSelectors.join(", ");
    let label = `${selectorSummary} { ${declarations.length} decls }`;
    if (context !== "top-level") {
      label = `[${context}] ${label}`;
    }
    if (isDuplicate) {
      label += " (duplicate selector)";
    }
    if (dupProps.length > 0) {
      label += ` (duplicate prop: ${dupProps.join(", ")})`;
    }

    entries.push({
      file: fileName,
      startLine,
      endLine,
      kind: "css_rule",
      label,
      depth,
      details: {
        context,
        selectors: selItems,
        declarationCount: declarations.length,
        declarations,
        isDuplicateSelector: isDuplicate,
        duplicateDeclarations: dupProps,
      },
    });
  }

  function processAtRule(node: SyntaxNode, depth = 0) {
    atRulesCount++;
    const headerMatch = node.text.match(/^(@[a-zA-Z-]+[^{;]*)/);
    const atHeader = headerMatch ? headerMatch[1].trim() : "@at-rule";

    entries.push({
      file: fileName,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      kind: "at_rule",
      label: atHeader,
      depth,
      details: { context: atHeader },
    });

    for (const child of node.children) {
      if (child.type === "rule_set") {
        processRuleSet(child, atHeader, depth + 1);
      } else if (child.type.endsWith("_statement") || child.type === "at_rule") {
        processAtRule(child, depth + 1);
      }
    }
  }

  // Iterate top-level nodes
  for (const node of tree.rootNode.children) {
    if (node.type === "rule_set") {
      processRuleSet(node, "top-level", 0);
    } else if (
      node.type === "media_statement" ||
      node.type === "supports_statement" ||
      node.type === "keyframes_statement" ||
      node.type === "font_face_statement" ||
      node.type === "layer_statement" ||
      node.type === "import_statement" ||
      node.type === "at_rule"
    ) {
      processAtRule(node, 0);
    }
  }

  return {
    entries,
    customPropertiesDeclared: Array.from(customPropertiesDeclared).sort(),
    customPropertiesUsed: Array.from(customPropertiesUsed).sort(),
    rulesCount,
    atRulesCount,
    duplicateSelectors: duplicateSelectorsList,
    duplicateDeclarationsTotal,
  };
}

