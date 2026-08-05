/**
 * Skeleton View Component (FR-P2, FR-P3, FR-P4, FR-P6).
 * Renders structural skeletons with [file:start-end] references and interactive full-source expansion.
 */

import { useState } from "react";
import { ListTree, Eye, X, Copy, Check } from "lucide-react";
import type { SkeletonEntry } from "../extract-html";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { copyToClipboard } from "../export";
import { toast } from "../../store/toast";

interface SkeletonViewProps {
  entries: SkeletonEntry[];
  rawText: string;
  fileName?: string;
  language?: string;
}

export function SkeletonView({ entries, rawText }: SkeletonViewProps) {
  const [expandedEntry, setExpandedEntry] = useState<SkeletonEntry | null>(null);
  const [copied, setCopied] = useState(false);

  const rawLines = rawText.split("\n");

  function getSnippet(entry: SkeletonEntry): string {
    const start = Math.max(0, entry.startLine - 1);
    const end = Math.min(rawLines.length, entry.endLine);
    return rawLines.slice(start, end).join("\n");
  }

  async function handleCopyExpanded() {
    if (!expandedEntry) return;
    const snippet = getSnippet(expandedEntry);
    const ok = await copyToClipboard(snippet);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied snippet to clipboard", `Lines ${expandedEntry.startLine}-${expandedEntry.endLine}`);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Skeleton Entries Card */}
      <div className="surface-card flex flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <ListTree className="h-4 w-4 text-accent" aria-hidden />
            <h3 className="text-sm font-semibold text-fg">Skeleton Outline</h3>
            <Badge tone="passed">{entries.length} symbols</Badge>
          </div>
          <span className="text-xs text-muted">Click "Expand" on any item to view source</span>
        </div>

        <div className="divide-y divide-line/40 max-h-[550px] overflow-y-auto p-2">
          {entries.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg hover:bg-surface-2 transition-colors"
              style={{ paddingLeft: `${entry.depth * 16 + 12}px` }}
            >
              <div className="min-w-0 flex items-center gap-2">
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-muted uppercase">
                  {entry.kind}
                </span>
                <span className="truncate font-mono text-xs text-fg">{entry.label}</span>
                <span className="text-[11px] text-muted font-mono shrink-0">
                  [{entry.file}:{entry.startLine}-{entry.endLine}]
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedEntry(entry)}
                className="h-7 px-2 text-xs text-accent shrink-0"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                Expand
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded Source Inspector Modal / Drawer (FR-P6) */}
      {expandedEntry && (
        <div className="surface-card border-accent/40 flex flex-col p-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-accent">Full Source Inspector</span>
              <span className="text-xs font-mono text-muted">
                [{expandedEntry.file}: lines {expandedEntry.startLine}-{expandedEntry.endLine}]
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyExpanded} className="h-7 text-xs">
                {copied ? <Check className="h-3.5 w-3.5 text-passed" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <button
                type="button"
                onClick={() => setExpandedEntry(null)}
                className="rounded p-1 text-muted hover:text-fg hover:bg-surface-2"
                aria-label="Close inspector"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs text-fg">
            <pre className="whitespace-pre-wrap">{getSnippet(expandedEntry)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
