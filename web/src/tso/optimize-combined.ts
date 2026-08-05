/**
 * Mode D: Combined Optimizer (FR-O4).
 * Combines Skeleton outline for the whole project with Focused Slices for chosen targets.
 * Recommended format for dense, high-fidelity LLM prompts.
 */

import type { SkeletonOptimizationResult } from "./optimize-skeleton";
import type { SliceOptimizationResult } from "./optimize-slice";
import { countTokens, TokenizerType } from "./tokens";

export interface CombinedOptimizationResult {
  text: string;
  rawChars: number;
  optimizedChars: number;
  rawTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  savingsPercent: number;
  sliceCount: number;
  fileCount: number;
}

export function buildCombinedContext(params: {
  skeletons: Array<{ fileName: string; skeleton: SkeletonOptimizationResult }>;
  slices: SliceOptimizationResult[];
  rawTotalChars: number;
  rawTotalTokens: number;
  tokenizer?: TokenizerType;
}): CombinedOptimizationResult {
  const tokenizer = params.tokenizer ?? "cl100k_light";
  const sections: string[] = [];

  sections.push("================================================================================");
  sections.push("AGENTIC-MESH TREE-SITTER OPTIMIZED CODEBASE CONTEXT (MODE: COMBINED SKELETON+SLICE)");
  sections.push("================================================================================");
  sections.push("// This context bundle contains:");
  sections.push("// 1. Complete structural skeletons of all project files (HTML, CSS, JS).");
  sections.push("// 2. Focused full-source slices for requested targets with surrounding context.");
  sections.push("// To inspect complete source for any skeleton item, request by [file:start-end].");
  sections.push("");

  sections.push("=== SECTION 1: PROJECT SKELETONS ===");
  sections.push("");
  for (const item of params.skeletons) {
    sections.push(`--- File: ${item.fileName} ---`);
    sections.push(item.skeleton.text);
    sections.push("");
  }

  if (params.slices.length > 0) {
    sections.push("=== SECTION 2: FOCUSED FULL-SOURCE SLICES ===");
    sections.push("");
    for (const slice of params.slices) {
      sections.push(`--- Slice for target "${slice.target}" in ${slice.matchedFile} [Lines ${slice.startLine}-${slice.endLine}] ---`);
      sections.push(slice.text);
      sections.push("");
    }
  }

  const combinedText = sections.join("\n");
  const optimizedTokens = countTokens(combinedText, tokenizer);
  const rawTokens = params.rawTotalTokens;
  const savedTokens = rawTokens - optimizedTokens;
  const savingsPercent = rawTokens > 0 ? Math.round((savedTokens / rawTokens) * 100) : 0;

  return {
    text: combinedText,
    rawChars: params.rawTotalChars,
    optimizedChars: combinedText.length,
    rawTokens,
    optimizedTokens,
    savedTokens,
    savingsPercent,
    sliceCount: params.slices.length,
    fileCount: params.skeletons.length,
  };
}

