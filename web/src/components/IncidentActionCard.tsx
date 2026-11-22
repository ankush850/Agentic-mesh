import React, { useState } from "react";
import { AlertTriangle, RotateCcw, Check, Code2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/Button";

export interface IncidentActionCardProps {
  service: string;
  symptom: string;
  rootCause: string;
  proposedAction: string;
  targetImage: string;
  stableImage: string;
  failingCodeSnippet?: string;
  filePath?: string;
  lineNo?: number;
  onApproveRollback: () => Promise<void>;
  onDismiss: () => void;
}

export function IncidentActionCard({
  service,
  symptom,
  rootCause,
  proposedAction,
  targetImage,
  stableImage,
  failingCodeSnippet,
  filePath = "services/payment/routes.ts",
  lineNo = 42,
  onApproveRollback,
  onDismiss,
}: IncidentActionCardProps) {
  const [loading, setLoading] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [showCode, setShowCode] = useState(true);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApproveRollback();
      setExecuted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-rose-500/40 bg-surface-1 p-5 shadow-xl transition-all">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-rose-400">
          <AlertTriangle className="h-5 w-5" />
          <h4 className="text-sm font-bold tracking-wide uppercase">Critical Infrastructure Incident</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 font-mono text-[11px] text-rose-300">
            Target: {service}
          </span>
          <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[11px] font-bold text-rose-400 uppercase">
            P0 Crash
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-3 text-xs">
        <div className="rounded-lg bg-surface-2 p-3">
          <span className="font-semibold text-fg">Detected Symptom: </span>
          <span className="text-muted">{symptom}</span>
        </div>

        <div className="rounded-lg bg-surface-2 p-3">
          <span className="font-semibold text-fg">LangGraph Root Cause Analysis: </span>
          <span className="text-muted">{rootCause}</span>
        </div>

        {/* Tree-sitter / AST Failing Code Injection Inspection */}
        {failingCodeSnippet && (
          <div className="rounded-lg border border-line bg-black/60 p-3">
            <div
              className="flex cursor-pointer items-center justify-between pb-2"
              onClick={() => setShowCode(!showCode)}
            >
              <div className="flex items-center gap-2 font-mono text-[11px] text-accent">
                <Code2 className="h-3.5 w-3.5" />
                <span>AST Extracted Fault Coordinates: {filePath}:{lineNo}</span>
              </div>
              <button type="button" className="text-muted hover:text-fg">
                {showCode ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>

            {showCode && (
              <pre className="overflow-x-auto rounded bg-surface-1/50 p-2.5 font-mono text-[11px] text-emerald-400 leading-relaxed border border-line/40">
                {failingCodeSnippet}
              </pre>
            )}
          </div>
        )}

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
          <span className="font-semibold">Proposed Remediation: </span>
          <span>{proposedAction}</span>
          <div className="mt-1.5 font-mono text-[11px]">
            Container Swap: <span className="text-rose-400 line-through">{targetImage}</span> →{" "}
            <span className="font-bold text-emerald-400">{stableImage}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3 border-t border-line pt-4">
        {executed ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <Check className="h-4 w-4" /> Container Rollback Completed & Restored!
          </div>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={onDismiss} disabled={loading}>
              Dismiss / Ignore
            </Button>
            <Button variant="danger" size="sm" loading={loading} onClick={handleApprove}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Approve Auto-Rollback
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
