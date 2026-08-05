/**
 * Stats Bar Component (FR-U4, FR-O6, FR-T1).
 * Displays file count, AST node count, raw tokens, optimized tokens,
 * honest percentage saved, and the tokenizer badge.
 */

import { Layers, Cpu, ArrowDown } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import type { TokenizerType } from "../tokens";

interface StatsBarProps {
  fileCount: number;
  nodeCount: number;
  rawTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  savingsPercent: number;
  tokenizer: TokenizerType;
  onTokenizerChange: (type: TokenizerType) => void;
}

export function StatsBar({
  fileCount,
  nodeCount,
  rawTokens,
  optimizedTokens,
  savedTokens,
  savingsPercent,
  tokenizer,
  onTokenizerChange,
}: StatsBarProps) {
  const isNegative = savedTokens < 0;

  return (
    <div className="surface-card flex flex-wrap items-center justify-between gap-4 p-4 text-xs">
      {/* Metrics Row */}
      <div className="flex flex-wrap items-center gap-6">
        {/* Files & AST Nodes */}
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted" aria-hidden />
          <span className="text-muted">Files:</span>
          <span className="font-semibold text-fg">{fileCount}</span>
          <span className="text-muted">|</span>
          <span className="text-muted">AST Nodes:</span>
          <span className="font-semibold text-fg">{nodeCount.toLocaleString()}</span>
        </div>

        {/* Raw Tokens */}
        <div className="flex items-center gap-2">
          <span className="text-muted">Raw:</span>
          <span className="font-semibold text-fg">{rawTokens.toLocaleString()}</span>
          {tokenizer === "approx" && (
            <span className="text-[10px] text-muted font-mono">(approx)</span>
          )}
        </div>

        {/* Optimized Tokens */}
        <div className="flex items-center gap-2">
          <span className="text-muted">Optimized:</span>
          <span className="font-semibold text-fg">{optimizedTokens.toLocaleString()}</span>
          {tokenizer === "approx" && (
            <span className="text-[10px] text-muted font-mono">(approx)</span>
          )}
        </div>

        {/* Savings Metric */}
        <div className="flex items-center gap-2">
          <Badge tone={isNegative ? "failed" : savingsPercent >= 70 ? "passed" : "healed"}>
            <ArrowDown className={`h-3 w-3 ${isNegative ? "rotate-180" : ""}`} aria-hidden />
            {isNegative ? `+${Math.abs(savingsPercent)}% (Negative savings)` : `${savingsPercent}% Saved`}
          </Badge>
          <span className="text-muted">({Math.abs(savedTokens).toLocaleString()} tokens)</span>
        </div>
      </div>

      {/* Tokenizer selector (FR-T1) */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 p-1">
          <Cpu className="ml-1 h-3.5 w-3.5 text-accent" aria-hidden />
          <button
            type="button"
            onClick={() => onTokenizerChange("cl100k_light")}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
              tokenizer === "cl100k_light"
                ? "bg-accent/20 text-accent font-semibold"
                : "text-muted hover:text-fg"
            }`}
          >
            cl100k
          </button>
          <button
            type="button"
            onClick={() => onTokenizerChange("approx")}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
              tokenizer === "approx"
                ? "bg-accent/20 text-accent font-semibold"
                : "text-muted hover:text-fg"
            }`}
          >
            approx (chars/4)
          </button>
        </div>
      </div>
    </div>
  );
}
