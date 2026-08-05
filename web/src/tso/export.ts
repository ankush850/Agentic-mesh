/**
 * Context Export Engine (FR-O7, FR-2.6).
 * Formats LLM-ready context bundles as human-readable Markdown (.md)
 * and machine-readable JSON (.json) with explicit range reference instructions.
 */

export interface ExportBundleParams {
  mode: "skeleton" | "minify" | "slice" | "combined";
  files: Array<{
    fileName: string;
    language: string;
    rawTokens: number;
    optimizedTokens: number;
    savedTokens: number;
    savingsPercent: number;
    content: string;
    entries?: Array<{ startLine: number; endLine: number; label: string; kind: string }>;
  }>;
  totalRawTokens: number;
  totalOptimizedTokens: number;
  totalSavedTokens: number;
  overallSavingsPercent: number;
  parityStatus: string;
}

/**
 * Sanitizes a file name for safe download (FR-2.6).
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

/**
 * Generates an LLM-ready Markdown bundle with instructional header (FR-O7).
 */
export function buildMarkdownExport(params: ExportBundleParams): string {
  const lines: string[] = [];

  lines.push("# Agentic-mesh Codebase Context (Tree-sitter Token-Optimized)");
  lines.push("");
  lines.push("> **LLM Prompt Instruction**: The code below has been optimized via Tree-sitter AST extraction.");
  lines.push(`> **Mode**: \`${params.mode}\` | **Savings**: \`${params.overallSavingsPercent}%\` (${params.totalSavedTokens.toLocaleString()} tokens saved) | **Parity**: \`${params.parityStatus}\``);
  lines.push("> **On-Demand Expansion**: Every structural entry is annotated with `[file:startLine-endLine]`. To inspect full implementation code, ask for `[file:start-end]`.");
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const f of params.files) {
    lines.push(`## File: \`${f.fileName}\` (${f.language.toUpperCase()})`);
    lines.push(`- Raw tokens: ${f.rawTokens.toLocaleString()} | Optimized: ${f.optimizedTokens.toLocaleString()} | Saved: ${f.savingsPercent}%`);
    lines.push("");
    lines.push("```" + (f.language === "js" ? "javascript" : f.language));
    lines.push(f.content);
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generates a structured JSON bundle for automated tools or LLM function calls (FR-O7).
 */
export function buildJsonExport(params: ExportBundleParams): string {
  const jsonObject = {
    generator: "Agentic-mesh Tree-sitter & Token Optimizer v1.0",
    instruction: "To inspect implementation details, query references matching [file:start-end].",
    generatedAt: new Date().toISOString(),
    mode: params.mode,
    stats: {
      totalRawTokens: params.totalRawTokens,
      totalOptimizedTokens: params.totalOptimizedTokens,
      totalSavedTokens: params.totalSavedTokens,
      overallSavingsPercent: params.overallSavingsPercent,
      parityStatus: params.parityStatus,
    },
    files: params.files.map((f) => ({
      fileName: f.fileName,
      language: f.language,
      rawTokens: f.rawTokens,
      optimizedTokens: f.optimizedTokens,
      savingsPercent: f.savingsPercent,
      content: f.content,
      entries: f.entries ?? [],
    })),
  };

  return JSON.stringify(jsonObject, null, 2);
}

/**
 * Browser file download helper without network dependencies.
 */
export function downloadFile(content: string, fileName: string, mimeType = "text/plain"): void {
  const safeName = sanitizeFileName(fileName);
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copies text securely to clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

