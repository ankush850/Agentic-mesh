/**
 * Parity and Fidelity Verification Engine (FR-O5).
 * Validates AST equivalence for safe minification and validates line ranges for skeletons and slices.
 */

import { Tree, parseHtml, parseCss, parseJs } from "./parse";

export interface ParityCheckResult {
  isVerified: boolean;
  mode: "skeleton" | "minify" | "slice" | "combined";
  errorCount: number;
  reason: string;
  differences?: string[];
}

/**
 * Extracts sequence of non-comment, non-whitespace AST node types from a Tree.
 */
function extractMeaningfulNodeSequence(tree: Tree): string[] {
  const sequence: string[] = [];
  for (const node of tree.rootNode.descendants()) {
    if (node.type !== "comment" && node.type !== "text") {
      sequence.push(node.type);
    } else if (node.type === "text" && node.text.trim().length > 0) {
      sequence.push("text");
    }
  }
  return sequence;
}

/**
 * Verifies parity for Safe Minify mode (FR-O5).
 * Re-parses minified text with tree-sitter, checks node type sequences against original,
 * and confirms zero introduced ERROR or MISSING nodes.
 */
export function verifyMinifyParity(
  originalTree: Tree,
  minifiedText: string,
  language: "html" | "css" | "js",
): ParityCheckResult {
  // Re-parse minified text
  const minifiedTree =
    language === "html" ? parseHtml(minifiedText) : language === "css" ? parseCss(minifiedText) : parseJs(minifiedText);

  // Check 1: Ensure no ERROR or MISSING nodes were introduced
  const errorNodes = minifiedTree.rootNode.descendants().filter((n) => n.type === "ERROR" || n.type === "MISSING");

  if (errorNodes.length > 0) {
    return {
      isVerified: false,
      mode: "minify",
      errorCount: errorNodes.length,
      reason: `Minification introduced ${errorNodes.length} syntax ERROR/MISSING nodes`,
      differences: errorNodes.map((n) => `At line ${n.startPosition.row + 1}: ${n.text.slice(0, 30)}`),
    };
  }

  // Check 2: Compare meaningful node sequence
  const origSeq = extractMeaningfulNodeSequence(originalTree);
  const minSeq = extractMeaningfulNodeSequence(minifiedTree);

  const diffs: string[] = [];
  const maxLen = Math.max(origSeq.length, minSeq.length);

  for (let i = 0; i < maxLen; i++) {
    if (origSeq[i] !== minSeq[i]) {
      diffs.push(`Position ${i}: expected <${origSeq[i] ?? "end"}>, found <${minSeq[i] ?? "end"}>`);
      if (diffs.length >= 5) break; // Limit reported differences
    }
  }

  if (diffs.length > 0) {
    return {
      isVerified: false,
      mode: "minify",
      errorCount: diffs.length,
      reason: `Node sequence mismatch between original and minified AST`,
      differences: diffs,
    };
  }

  return {
    isVerified: true,
    mode: "minify",
    errorCount: 0,
    reason: `Verified: Node sequence matched perfectly (${minSeq.length} nodes, 0 errors)`,
  };
}

/**
 * Verifies that all [file:start-end] references in text exist within file line limits (FR-O5).
 */
export function verifyRangeReferences(
  text: string,
  fileLineCounts: Record<string, number>,
): ParityCheckResult {
  const rangeRegex = /\[([^:\]]+):(\d+)-(\d+)\]/g;
  let match: RegExpExecArray | null;
  const invalidRanges: string[] = [];

  while ((match = rangeRegex.exec(text)) !== null) {
    const file = match[1];
    const startLine = parseInt(match[2], 10);
    const endLine = parseInt(match[3], 10);

    const maxLines = fileLineCounts[file];
    if (maxLines !== undefined) {
      if (startLine < 1 || endLine > maxLines || startLine > endLine) {
        invalidRanges.push(`Invalid range [${file}:${startLine}-${endLine}] (total lines: ${maxLines})`);
      }
    }
  }

  if (invalidRanges.length > 0) {
    return {
      isVerified: false,
      mode: "skeleton",
      errorCount: invalidRanges.length,
      reason: `Found ${invalidRanges.length} out-of-bounds line range references`,
      differences: invalidRanges,
    };
  }

  return {
    isVerified: true,
    mode: "skeleton",
    errorCount: 0,
    reason: "Verified: All referenced line ranges exist and lie within file line counts",
  };
}
