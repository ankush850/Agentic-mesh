import * as path from "path";
import { AppModel } from "./astParser";

export type TokenizerType = "approx" | "cl100k_light";

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
  entries: any[];
}

export interface SliceOptimizationResult {
  target: string;
  matchedFile: string;
  startLine: number;
  endLine: number;
  text: string;
  rawChars: number;
  optimizedChars: number;
  rawTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  savingsPercent: number;
}

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

export interface CompressionStats {
  beforeChars: number;
  afterChars: number;
  beforeTokens: number;
  afterTokens: number;
  savedTokens: number;
  savingsPercent: number;
  pageCount: number;
}

export interface CompressedPageContext {
  route: string;
  file: string;
  optimizedText: string;
  rawTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  savingsPercent: number;
}

export interface CompressedAppModelResult {
  optimizedContext: string;
  pages: CompressedPageContext[];
  stats: CompressionStats;
  combinedResult: CombinedOptimizationResult;
}

export interface CompressOptions {
  focusPage?: string;
  tokenizer?: TokenizerType;
}

// Regex for standard GPT/cl100k token boundary splitting (same as web/src/tso/tokens)
const CL100K_PATTERN =
  /(?:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu;

/**
 * Counts tokens using the existing Token Optimizer algorithm.
 */
export function countTokens(text: string, tokenizer: TokenizerType = "cl100k_light"): number {
  if (!text) return 0;
  if (tokenizer === "approx") {
    return Math.max(1, Math.ceil(text.length / 4));
  }
  let count = 0;
  const regex = new RegExp(CL100K_PATTERN);
  while (regex.exec(text) !== null) {
    count++;
  }
  return Math.max(1, count);
}

/**
 * Mode D Combined Context Builder (exact parity with web/src/tso/optimize-combined).
 */
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
      sections.push(
        `--- Slice for target "${slice.target}" in ${slice.matchedFile} [Lines ${slice.startLine}-${slice.endLine}] ---`
      );
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

/**
 * Builds raw text representation of page elements and structures for token comparison.
 */
function buildRawPageText(pageFile: string, model: AppModel): string {
  const lines: string[] = [];
  lines.push(`<!-- Source Page: ${pageFile} -->`);

  const pageElements = (model.interactiveElements || []).filter((e) => e.sourceFile === pageFile);
  for (const el of pageElements) {
    const attrs = [
      el.id ? `id="${el.id}"` : "",
      el.name ? `name="${el.name}"` : "",
      el.type ? `type="${el.type}"` : "",
      el.dataTestId ? `data-testid="${el.dataTestId}"` : "",
      el.placeholder ? `placeholder="${el.placeholder}"` : "",
      el.className ? `class="${el.className}"` : "",
      el.role ? `role="${el.role}"` : "",
      el.href ? `href="${el.href}"` : "",
      ...(el.eventHandlers || []).map((h) => `${h}="..."`),
    ]
      .filter(Boolean)
      .join(" ");

    lines.push(
      `<${el.tag} ${attrs}>${el.text || el.visibleText || ""}</${el.tag}> <!-- [${el.sourceFile}:${el.startLine}-${el.endLine || el.startLine}] fingerprint: ${el.sourceFingerprint} -->`
    );
  }

  const pageForms = (model.forms || []).filter((f) => f.sourceFile === pageFile);
  for (const form of pageForms) {
    lines.push(
      `<form id="${form.id || ""}" action="${form.action || ""}" method="${form.method || ""}">`
    );
    for (const field of form.fields || []) {
      lines.push(
        `  <${field.tag} name="${field.name || ""}" type="${field.type || ""}" placeholder="${field.placeholder || ""}" />`
      );
    }
    lines.push(`</form>`);
  }

  return lines.join("\n");
}

/**
 * Builds compact skeleton text for a page.
 */
function buildSkeletonPageText(pageFile: string, model: AppModel): string {
  const lines: string[] = [];
  lines.push(`// SKELETON: Page ${pageFile}`);

  const pageForms = (model.forms || []).filter((f) => f.sourceFile === pageFile);
  for (const f of pageForms) {
    const fieldsSummary = (f.fields || [])
      .map((fld) => `${fld.tag}[${fld.name || fld.id || fld.type || ""}]`)
      .join(", ");
    lines.push(
      `  form#${f.id || "unnamed"} (${f.method || "GET"} ${f.action || "/"}) [${fieldsSummary}] [${f.sourceFile}:${f.startLine}-${f.endLine || f.startLine}]`
    );
  }

  const pageElements = (model.interactiveElements || []).filter((e) => e.sourceFile === pageFile);
  for (const el of pageElements) {
    const roleStr = el.role ? `@${el.role}` : "";
    const idStr = el.id ? `#${el.id}` : "";
    const testIdStr = el.dataTestId ? `[data-testid="${el.dataTestId}"]` : "";
    const label = el.text || el.visibleText;
    const textStr = label ? ` "${label.slice(0, 25)}"` : "";
    const handlersStr = (el.eventHandlers || []).length > 0 ? ` {${el.eventHandlers.join(",")}}` : "";

    lines.push(
      `  ${el.tag}${idStr}${roleStr}${testIdStr}${textStr}${handlersStr} [${el.sourceFile}:${el.startLine}-${el.endLine || el.startLine}] fp:${el.sourceFingerprint}`
    );
  }

  const links = (model.navigationLinks || []).filter((l) => l.sourceFile === pageFile);
  if (links.length > 0) {
    lines.push(`  nav-links: ${links.map((l) => `${l.href}(${l.text || ""})`).join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Adapts the AppModel into the Token Optimizer format, chunked by page.
 */
export function compressAppModel(
  model: AppModel,
  options: CompressOptions = {}
): CompressedAppModelResult {
  const tokenizer: TokenizerType = options.tokenizer ?? "cl100k_light";
  const pageContexts: CompressedPageContext[] = [];
  const skeletons: Array<{ fileName: string; skeleton: SkeletonOptimizationResult }> = [];
  const slices: SliceOptimizationResult[] = [];

  let rawTotalChars = 0;
  let rawTotalTokens = 0;

  // Process unique pages or unique source files
  let filesToProcess = Array.from(
    new Set([
      ...model.pages.map((p) => p.file || (p as any).routeOrFile),
      ...(model.interactiveElements || []).map((e) => e.sourceFile),
    ])
  ).filter(Boolean);

  if (options.focusPage) {
    const focusLower = options.focusPage.toLowerCase();
    const matched = filesToProcess.filter((f) => f.toLowerCase().includes(focusLower));
    if (matched.length > 0) {
      filesToProcess = matched;
    }
  }

  for (const fileName of filesToProcess) {
    const rawText = buildRawPageText(fileName, model);
    const skeletonText = buildSkeletonPageText(fileName, model);

    const rawChars = rawText.length;
    const optChars = skeletonText.length;
    const pageRawTokens = countTokens(rawText, tokenizer);
    const pageOptTokens = countTokens(skeletonText, tokenizer);
    const saved = pageRawTokens - pageOptTokens;
    const pct = pageRawTokens > 0 ? Math.round((saved / pageRawTokens) * 100) : 0;

    rawTotalChars += rawChars;
    rawTotalTokens += pageRawTokens;

    const skeletonResult: SkeletonOptimizationResult = {
      text: skeletonText,
      rawChars,
      optimizedChars: optChars,
      rawTokens: pageRawTokens,
      optimizedTokens: pageOptTokens,
      savedTokens: saved,
      savingsPercent: pct,
      dropped: {
        comments: 0,
        textChars: Math.max(0, rawChars - optChars),
        ruleBodies: 0,
        functionBodies: 0,
      },
      entries: [],
    };

    skeletons.push({ fileName, skeleton: skeletonResult });

    const matchedPage = model.pages.find((p) => (p.file || (p as any).routeOrFile) === fileName);
    const route = matchedPage ? matchedPage.route : `/${fileName}`;

    pageContexts.push({
      route,
      file: fileName,
      optimizedText: skeletonText,
      rawTokens: pageRawTokens,
      optimizedTokens: pageOptTokens,
      savedTokens: saved,
      savingsPercent: pct,
    });
  }

  // Build combined context via optimizer
  const combined: CombinedOptimizationResult = buildCombinedContext({
    skeletons,
    slices,
    rawTotalChars,
    rawTotalTokens,
    tokenizer,
  });

  const stats: CompressionStats = {
    beforeChars: combined.rawChars,
    afterChars: combined.optimizedChars,
    beforeTokens: combined.rawTokens,
    afterTokens: combined.optimizedTokens,
    savedTokens: combined.savedTokens,
    savingsPercent: combined.savingsPercent,
    pageCount: filesToProcess.length,
  };

  return {
    optimizedContext: combined.text,
    pages: pageContexts,
    stats,
    combinedResult: combined,
  };
}
