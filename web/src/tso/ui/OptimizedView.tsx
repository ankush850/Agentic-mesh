/**
 * Optimized View Component (FR-O1 through FR-O7).
 * Provides optimization mode selection, target query for focused slicing,
 * fidelity verification badges, detailed breakdown of dropped elements,
 * and export actions (Copy, Download .md, Download .json).
 */

import { useState } from "react";
import { Copy, Check, ShieldCheck, ShieldAlert, Search, FileText, FileJson } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { copyToClipboard, downloadFile, buildMarkdownExport, buildJsonExport } from "../export";
import { toast } from "../../store/toast";

export type OptimizationMode = "skeleton" | "minify" | "slice" | "combined";

interface OptimizedViewProps {
  mode: OptimizationMode;
  onModeChange: (mode: OptimizationMode) => void;
  sliceTarget: string;
  onSliceTargetChange: (target: string) => void;
  optimizedText: string;
  rawTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  savingsPercent: number;
  isVerified: boolean;
  verificationReason: string;
  droppedSummary: {
    comments?: number;
    whitespaceChars?: number;
    textChars?: number;
    ruleBodies?: number;
    functionBodies?: number;
  };
  fileName: string;
  language: string;
}

export function OptimizedView({
  mode,
  onModeChange,
  sliceTarget,
  onSliceTargetChange,
  optimizedText,
  rawTokens,
  optimizedTokens,
  savedTokens,
  savingsPercent,
  isVerified,
  verificationReason,
  droppedSummary,
  fileName,
  language,
}: OptimizedViewProps) {
  const [copied, setCopied] = useState(false);

  const isNegative = savedTokens < 0;

  async function handleCopy() {
    const ok = await copyToClipboard(optimizedText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Optimized code copied to clipboard");
    }
  }

  function handleDownloadMd() {
    const md = buildMarkdownExport({
      mode,
      files: [
        {
          fileName,
          language,
          rawTokens,
          optimizedTokens,
          savedTokens,
          savingsPercent,
          content: optimizedText,
        },
      ],
      totalRawTokens: rawTokens,
      totalOptimizedTokens: optimizedTokens,
      totalSavedTokens: savedTokens,
      overallSavingsPercent: savingsPercent,
      parityStatus: isVerified ? "Verified" : "Not Verified",
    });

    downloadFile(md, `${fileName}.optimized.md`, "text/markdown");
    toast.success("Downloaded Markdown context bundle");
  }

  function handleDownloadJson() {
    const json = buildJsonExport({
      mode,
      files: [
        {
          fileName,
          language,
          rawTokens,
          optimizedTokens,
          savedTokens,
          savingsPercent,
          content: optimizedText,
        },
      ],
      totalRawTokens: rawTokens,
      totalOptimizedTokens: optimizedTokens,
      totalSavedTokens: savedTokens,
      overallSavingsPercent: savingsPercent,
      parityStatus: isVerified ? "Verified" : "Not Verified",
    });

    downloadFile(json, `${fileName}.optimized.json`, "application/json");
    toast.success("Downloaded JSON context bundle");
  }

  return (
    <div className="surface-card flex flex-col gap-4 p-5">
      {/* Optimization Mode Picker Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-fg">Optimization Mode:</span>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => onModeChange("skeleton")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === "skeleton" ? "bg-accent/20 text-accent font-semibold" : "text-muted hover:text-fg"
              }`}
            >
              Skeleton (Mode A)
            </button>
            <button
              type="button"
              onClick={() => onModeChange("minify")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === "minify" ? "bg-accent/20 text-accent font-semibold" : "text-muted hover:text-fg"
              }`}
            >
              Safe Minify (Mode B)
            </button>
            <button
              type="button"
              onClick={() => onModeChange("slice")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === "slice" ? "bg-accent/20 text-accent font-semibold" : "text-muted hover:text-fg"
              }`}
            >
              Focused Slice (Mode C)
            </button>
            <button
              type="button"
              onClick={() => onModeChange("combined")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === "combined" ? "bg-accent/20 text-accent font-semibold" : "text-muted hover:text-fg"
              }`}
            >
              Combined (Mode D)
            </button>
          </div>
        </div>

        {/* Parity Status Badge (FR-O5) */}
        <div className="flex items-center gap-2">
          <Badge tone={isVerified ? "passed" : "failed"}>
            {isVerified ? (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            )}
            {isVerified ? "Verified (Parity OK)" : "Not Verified"}
          </Badge>
          {verificationReason && (
            <span className="text-[11px] text-muted max-w-xs truncate" title={verificationReason}>
              ({verificationReason})
            </span>
          )}
        </div>
      </div>

      {/* Target input for Focused Slice mode (FR-O3) */}
      {(mode === "slice" || mode === "combined") && (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-2.5">
          <Search className="h-4 w-4 text-accent shrink-0" aria-hidden />
          <input
            type="text"
            value={sliceTarget}
            onChange={(e) => onSliceTargetChange(e.target.value)}
            placeholder="Enter target symbol, selector, id, or function name (e.g. #login-btn, .card, handleSubmit)..."
            className="flex-1 bg-transparent text-xs text-fg placeholder:text-muted focus:outline-none"
            aria-label="Target slice symbol or query"
          />
        </div>
      )}

      {/* Detailed Dropped Tokens & Elements Breakdown (FR-O6) */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted rounded-lg bg-surface-2 px-3.5 py-2">
        <span className="font-medium text-fg">Dropped / Compacted:</span>
        {droppedSummary.comments !== undefined && (
          <span>{droppedSummary.comments} comments removed</span>
        )}
        {droppedSummary.whitespaceChars !== undefined && (
          <span>{droppedSummary.whitespaceChars.toLocaleString()} whitespace chars collapsed</span>
        )}
        {droppedSummary.textChars !== undefined && droppedSummary.textChars > 0 && (
          <span>{droppedSummary.textChars.toLocaleString()} body text chars dropped</span>
        )}
        {droppedSummary.ruleBodies !== undefined && droppedSummary.ruleBodies > 0 && (
          <span>{droppedSummary.ruleBodies} rule bodies condensed</span>
        )}
        {droppedSummary.functionBodies !== undefined && droppedSummary.functionBodies > 0 && (
          <span>{droppedSummary.functionBodies} function bodies condensed</span>
        )}
        {isNegative && (
          <span className="text-failed font-semibold">
            Notice: Raw text is smaller than optimized structure. Raw code is recommended.
          </span>
        )}
      </div>

      {/* Optimized Code Display */}
      <div className="relative rounded-xl border border-line bg-surface-2 p-4 font-mono text-xs max-h-[460px] overflow-y-auto">
        <pre className="text-fg whitespace-pre-wrap break-all">{optimizedText || "No content generated."}</pre>
      </div>

      {/* Export & Action Buttons (FR-O7) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <span className="text-xs text-muted italic">
          Tip: Prompt LLM with [file:start-end] to request specific source expansions.
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5 text-passed" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy to Clipboard"}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownloadMd}>
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Download .md
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownloadJson}>
            <FileJson className="h-3.5 w-3.5" aria-hidden />
            Download .json
          </Button>
        </div>
      </div>
    </div>
  );
}
