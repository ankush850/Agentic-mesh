/**
 * Mode A: Skeleton Optimizer (FR-O1).
 * Generates compact indented outlines with [file:start-end] references.
 * Documents dropped elements, bodies, and text nodes with detailed counts.
 */

import type { SkeletonEntry, HtmlExtractionResult } from "./extract-html";
import type { CssExtractionResult } from "./extract-css";
import type { JsExtractionResult } from "./extract-js";
import { countTokens, TokenizerType } from "./tokens";

export interface SkeletonOptimizationResult {
  text: string;
  rawChars: number;
  optimizedChars: number;
  rawTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  savingsPercent: number;
  dropped: {
    comments: number;
    textChars: number;
    ruleBodies: number;
    functionBodies: number;
  };
  entries: SkeletonEntry[];
}

export function optimizeHtmlToSkeleton(
  rawText: string,
  result: HtmlExtractionResult,
  fileName: string,
  tokenizer: TokenizerType = "cl100k_light",
): SkeletonOptimizationResult {
  const lines: string[] = [];
  lines.push(`// SKELETON: HTML Document Outline for ${fileName}`);
  lines.push(`// Format: <tag#id.class key-attrs> [${fileName}:startLine-endLine]`);
  lines.push("");

  let commentCount = 0;
  for (const _ of rawText.matchAll(/<!--[\s\S]*?-->/g)) commentCount++;

  for (const entry of result.entries) {
    const indent = "  ".repeat(entry.depth);
    lines.push(`${indent}${entry.label} [${fileName}:${entry.startLine}-${entry.endLine}]`);
  }

  const optimizedText = lines.join("\n");
  const rawTokens = countTokens(rawText, tokenizer);
  const optimizedTokens = countTokens(optimizedText, tokenizer);
  const savedTokens = rawTokens - optimizedTokens;
  const savingsPercent = rawTokens > 0 ? Math.round((savedTokens / rawTokens) * 100) : 0;

  return {
    text: optimizedText,
    rawChars: rawText.length,
    optimizedChars: optimizedText.length,
    rawTokens,
    optimizedTokens,
    savedTokens,
    savingsPercent,
    dropped: {
      comments: commentCount,
      textChars: result.droppedTextChars,
      ruleBodies: 0,
      functionBodies: 0,
    },
    entries: result.entries,
  };
}

export function optimizeCssToSkeleton(
  rawText: string,
  result: CssExtractionResult,
  fileName: string,
  tokenizer: TokenizerType = "cl100k_light",
): SkeletonOptimizationResult {
  const lines: string[] = [];
  lines.push(`/* SKELETON: CSS Style Rules for ${fileName} */`);
  lines.push(`/* Format: selector { decl_count } [${fileName}:startLine-endLine] */`);
  lines.push("");

  if (result.customPropertiesDeclared.length > 0) {
    lines.push(`/* Custom properties declared: ${result.customPropertiesDeclared.join(", ")} */`);
    lines.push("");
  }

  let commentCount = 0;
  for (const _ of rawText.matchAll(/\/\*[\s\S]*?\*\//g)) commentCount++;

  for (const entry of result.entries) {
    const indent = "  ".repeat(entry.depth);
    lines.push(`${indent}${entry.label} [${fileName}:${entry.startLine}-${entry.endLine}]`);
  }

  const optimizedText = lines.join("\n");
  const rawTokens = countTokens(rawText, tokenizer);
  const optimizedTokens = countTokens(optimizedText, tokenizer);
  const savedTokens = rawTokens - optimizedTokens;
  const savingsPercent = rawTokens > 0 ? Math.round((savedTokens / rawTokens) * 100) : 0;

  return {
    text: optimizedText,
    rawChars: rawText.length,
    optimizedChars: optimizedText.length,
    rawTokens,
    optimizedTokens,
    savedTokens,
    savingsPercent,
    dropped: {
      comments: commentCount,
      textChars: 0,
      ruleBodies: result.rulesCount,
      functionBodies: 0,
    },
    entries: result.entries,
  };
}

export function optimizeJsToSkeleton(
  rawText: string,
  result: JsExtractionResult,
  fileName: string,
  tokenizer: TokenizerType = "cl100k_light",
): SkeletonOptimizationResult {
  const lines: string[] = [];
  lines.push(`// SKELETON: JavaScript Symbol Outline for ${fileName}`);
  lines.push(`// Format: signature [${fileName}:startLine-endLine]`);
  lines.push("");

  let commentCount = 0;
  for (const _ of rawText.matchAll(/\/\/.*|\/\*[\s\S]*?\*\//g)) commentCount++;

  for (const entry of result.entries) {
    const indent = "  ".repeat(entry.depth);
    lines.push(`${indent}${entry.label} [${fileName}:${entry.startLine}-${entry.endLine}]`);
  }

  const optimizedText = lines.join("\n");
  const rawTokens = countTokens(rawText, tokenizer);
  const optimizedTokens = countTokens(optimizedText, tokenizer);
  const savedTokens = rawTokens - optimizedTokens;
  const savingsPercent = rawTokens > 0 ? Math.round((savedTokens / rawTokens) * 100) : 0;

  return {
    text: optimizedText,
    rawChars: rawText.length,
    optimizedChars: optimizedText.length,
    rawTokens,
    optimizedTokens,
    savedTokens,
    savingsPercent,
    dropped: {
      comments: commentCount,
      textChars: 0,
      ruleBodies: 0,
      functionBodies: result.functionsCount + result.classesCount,
    },
    entries: result.entries,
  };
}
