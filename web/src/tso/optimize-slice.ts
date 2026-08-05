/**
 * Mode C: Focused Slice Optimizer (FR-O3).
 * Extracts full source for target symbol/selector plus minimal context,
 * replacing unselected code with one-line [file:start-end] placeholders.
 */

import { Tree, SyntaxNode } from "./parse";
import { countTokens, TokenizerType } from "./tokens";
import type { CssExtractionResult } from "./extract-css";
import type { JsExtractionResult } from "./extract-js";

export interface SliceOptimizationResult {
  text: string;
  target: string;
  matchedFile: string;
  startLine: number;
  endLine: number;
  contextSummary: string;
  rawTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  savingsPercent: number;
}

/**
 * Extracts a focused slice from an HTML document (FR-O3).
 */
export function sliceHtml(
  rawText: string,
  tree: Tree,
  target: string,
  fileName = "index.html",
  cssResult?: CssExtractionResult,
  _jsResult?: JsExtractionResult,
  tokenizer: TokenizerType = "cl100k_light",
): SliceOptimizationResult | null {
  const cleanTarget = target.trim().toLowerCase();
  const rawLines = rawText.split("\n");

  let targetNode: SyntaxNode | null = null;
  const breadcrumbs: string[] = [];

  for (const node of tree.rootNode.descendants()) {
    if (node.type === "element") {
      const startTag = node.children.find((c) => c.type === "start_tag");
      const tagName = startTag?.children.find((c) => c.type === "tag_name")?.text.toLowerCase() ?? "";

      const textLower = node.text.toLowerCase();
      const matchesTarget =
        (cleanTarget.startsWith("#") && textLower.includes(`id="${cleanTarget.slice(1)}"`)) ||
        (cleanTarget.startsWith(".") && textLower.includes(cleanTarget.slice(1))) ||
        tagName === cleanTarget ||
        textLower.includes(cleanTarget);

      if (matchesTarget) {
        targetNode = node;
        let cur = node.parent;
        while (cur && cur.type === "element") {
          const pTag =
            cur.children.find((c) => c.type === "start_tag")?.children.find((c) => c.type === "tag_name")?.text ?? "el";
          breadcrumbs.unshift(pTag);
          cur = cur.parent;
        }
        break;
      }
    }
  }

  if (!targetNode) return null;

  const startLine = targetNode.startPosition.row + 1;
  let endLine = targetNode.endPosition.row + 1;
  let fullTargetText = targetNode.text;

  // If element has a closing tag in rawText, expand to include it and full inner content
  const startTag = targetNode.children.find((c) => c.type === "start_tag");
  const tagName = startTag?.children.find((c) => c.type === "tag_name")?.text.toLowerCase() ?? "";
  if (tagName && !["meta", "link", "input", "img", "br", "hr"].includes(tagName)) {
    const closeTag = `</${tagName}>`;
    const closeIdx = rawText.toLowerCase().indexOf(closeTag, targetNode.startIndex);
    if (closeIdx !== -1) {
      const sliceEnd = closeIdx + closeTag.length;
      fullTargetText = rawText.slice(targetNode.startIndex, sliceEnd);
      endLine = rawText.slice(0, sliceEnd).split("\n").length;
    }
  }

  const lines: string[] = [];
  lines.push(`<!-- FOCUSED SLICE: HTML element matching "${target}" in ${fileName} -->`);
  if (breadcrumbs.length > 0) {
    lines.push(`<!-- Path: ${breadcrumbs.join(" > ")} > [Target] -->`);
  }

  const connectedStyles: string[] = [];
  if (cssResult) {
    for (const rule of cssResult.entries) {
      if (rule.label.toLowerCase().includes(cleanTarget)) {
        connectedStyles.push(`  ${rule.label} [${rule.file}:${rule.startLine}-${rule.endLine}]`);
      }
    }
  }
  if (connectedStyles.length > 0) {
    lines.push(`<!-- Connected CSS Styles: -->`);
    lines.push(...connectedStyles);
  }

  lines.push("");

  if (startLine > 1) {
    lines.push(`<!-- [${fileName}:1-${startLine - 1}] (${startLine - 1} lines collapsed) -->`);
  }

  lines.push(fullTargetText);

  if (endLine < rawLines.length) {
    lines.push(`<!-- [${fileName}:${endLine + 1}-${rawLines.length}] (${rawLines.length - endLine} lines collapsed) -->`);
  }

  const resultText = lines.join("\n");
  const rawTokens = countTokens(rawText, tokenizer);
  const optimizedTokens = countTokens(resultText, tokenizer);
  const savedTokens = rawTokens - optimizedTokens;
  const savingsPercent = rawTokens > 0 ? Math.round((savedTokens / rawTokens) * 100) : 0;

  return {
    text: resultText,
    target,
    matchedFile: fileName,
    startLine,
    endLine,
    contextSummary: `Element <${targetNode.type}> with ${breadcrumbs.length} ancestors`,
    rawTokens,
    optimizedTokens,
    savedTokens,
    savingsPercent,
  };
}

/**
 * Extracts a focused slice from a CSS stylesheet (FR-O3).
 */
export function sliceCss(
  rawText: string,
  tree: Tree,
  target: string,
  fileName = "styles.css",
  tokenizer: TokenizerType = "cl100k_light",
): SliceOptimizationResult | null {
  const cleanTarget = target.trim().toLowerCase();
  const rawLines = rawText.split("\n");

  let targetNode: SyntaxNode | null = null;
  let atRuleContext = "";

  for (const node of tree.rootNode.descendants()) {
    if (node.type === "rule_set") {
      const selectorsNode = node.children.find((c) => c.type === "selectors");
      const selText = (selectorsNode?.text ?? "").toLowerCase();

      if (selText.includes(cleanTarget)) {
        targetNode = node;
        let p = node.parent;
        while (p) {
          if (p.type.endsWith("_statement") || p.type === "at_rule") {
            const h = p.text.match(/^(@[a-zA-Z-]+[^{;]*)/);
            if (h) atRuleContext = h[1].trim();
            break;
          }
          p = p.parent;
        }
        break;
      }
    }
  }

  if (!targetNode) return null;

  const startLine = targetNode.startPosition.row + 1;
  const endLine = targetNode.endPosition.row + 1;

  const usedVars: string[] = [];
  for (const m of targetNode.text.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)) {
    usedVars.push(m[1]);
  }

  const lines: string[] = [];
  lines.push(`/* FOCUSED SLICE: CSS rule for "${target}" in ${fileName} */`);
  if (atRuleContext) lines.push(`/* Enclosing context: ${atRuleContext} */`);
  if (usedVars.length > 0) lines.push(`/* Custom properties used: ${usedVars.join(", ")} */`);
  lines.push("");

  if (startLine > 1) {
    lines.push(`/* [${fileName}:1-${startLine - 1}] (${startLine - 1} lines collapsed) */`);
  }

  if (atRuleContext) {
    lines.push(`${atRuleContext} {`);
    lines.push(`  ${targetNode.text.split("\n").join("\n  ")}`);
    lines.push(`}`);
  } else {
    lines.push(targetNode.text);
  }

  if (endLine < rawLines.length) {
    lines.push(`/* [${fileName}:${endLine + 1}-${rawLines.length}] (${rawLines.length - endLine} lines collapsed) */`);
  }

  const resultText = lines.join("\n");
  const rawTokens = countTokens(rawText, tokenizer);
  const optimizedTokens = countTokens(resultText, tokenizer);
  const savedTokens = rawTokens - optimizedTokens;
  const savingsPercent = rawTokens > 0 ? Math.round((savedTokens / rawTokens) * 100) : 0;

  return {
    text: resultText,
    target,
    matchedFile: fileName,
    startLine,
    endLine,
    contextSummary: atRuleContext ? `Wrapped in ${atRuleContext}` : "Top-level style rule",
    rawTokens,
    optimizedTokens,
    savedTokens,
    savingsPercent,
  };
}

/**
 * Extracts a focused slice from a JavaScript file (FR-O3).
 */
export function sliceJs(
  rawText: string,
  tree: Tree,
  target: string,
  fileName = "script.js",
  tokenizer: TokenizerType = "cl100k_light",
): SliceOptimizationResult | null {
  const cleanTarget = target.trim().toLowerCase();
  const rawLines = rawText.split("\n");

  let targetNode: SyntaxNode | null = null;
  const importsUsed: string[] = [];
  const calledSignatures: string[] = [];

  for (const node of tree.rootNode.descendants()) {
    if (node.type === "import_statement") {
      importsUsed.push(node.text.trim());
    }
  }

  for (const node of tree.rootNode.descendants()) {
    if (node.type === "function_declaration" || node.type === "class_declaration" || node.type === "arrow_function") {
      const idNode = node.children.find((c) => c.type === "identifier");
      const name = (idNode?.text ?? "").toLowerCase();

      if (name === cleanTarget || node.text.toLowerCase().includes(cleanTarget)) {
        targetNode = node;
        break;
      }
    }
  }

  if (!targetNode) return null;

  const startLine = targetNode.startPosition.row + 1;
  const endLine = targetNode.endPosition.row + 1;

  const callMatches = targetNode.text.matchAll(/([a-zA-Z0-9_$]+)\s*\([^)]*\)/g);
  for (const cm of callMatches) {
    if (cm[1] !== target && !["if", "for", "while", "catch", "switch"].includes(cm[1])) {
      calledSignatures.push(`function ${cm[1]}(...)`);
    }
  }

  const lines: string[] = [];
  lines.push(`// FOCUSED SLICE: JavaScript symbol for "${target}" in ${fileName}`);
  if (importsUsed.length > 0) {
    lines.push(`// Module imports:`);
    for (const imp of importsUsed) lines.push(`//   ${imp}`);
  }
  if (calledSignatures.length > 0) {
    lines.push(`// Called function signatures: ${Array.from(new Set(calledSignatures)).slice(0, 5).join(", ")}`);
  }
  lines.push("");

  if (startLine > 1) {
    lines.push(`/* [${fileName}:1-${startLine - 1}] (${startLine - 1} lines collapsed) */`);
  }

  lines.push(targetNode.text);

  if (endLine < rawLines.length) {
    lines.push(`/* [${fileName}:${endLine + 1}-${rawLines.length}] (${rawLines.length - endLine} lines collapsed) */`);
  }

  const resultText = lines.join("\n");
  const rawTokens = countTokens(rawText, tokenizer);
  const optimizedTokens = countTokens(resultText, tokenizer);
  const savedTokens = rawTokens - optimizedTokens;
  const savingsPercent = rawTokens > 0 ? Math.round((savedTokens / rawTokens) * 100) : 0;

  return {
    text: resultText,
    target,
    matchedFile: fileName,
    startLine,
    endLine,
    contextSummary: `Symbol ${targetNode.type} with ${importsUsed.length} imports`,
    rawTokens,
    optimizedTokens,
    savedTokens,
    savingsPercent,
  };
}
