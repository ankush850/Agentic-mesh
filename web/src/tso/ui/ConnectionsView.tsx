/**
 * Cross-File Connections View Component (FR-P5).
 * Renders HTML-CSS-JS dependency links, matched/unused CSS selectors,
 * resolved/unresolved JS DOM queries, warning alerts, and an SVG dependency graph.
 */

import { AlertTriangle, Network, ArrowRight } from "lucide-react";
import type { ProjectConnections } from "../connections";
import { Badge } from "../../components/ui/Badge";

interface ConnectionsViewProps {
  connections: ProjectConnections;
}

export function ConnectionsView({ connections }: ConnectionsViewProps) {
  const warnings = connections.warnings;

  return (
    <div className="flex flex-col gap-6">
      {/* Warnings Panel (FR-P5d) */}
      {warnings.length > 0 && (
        <div className="surface-card border-healed/40 flex flex-col p-4 bg-healed/5">
          <div className="flex items-center gap-2 text-healed mb-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <h4 className="text-xs font-semibold">
              Cross-File Diagnostics & Warnings ({warnings.length}):
            </h4>
          </div>
          <div className="divide-y divide-line/40 max-h-48 overflow-y-auto text-xs">
            {warnings.map((w, idx) => (
              <div key={idx} className="py-2 flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="font-semibold text-fg">[{w.code}]</span> {w.message}
                  <div className="text-[11px] text-muted">
                    File: <code className="text-accent">{w.file}</code> {w.line ? `(line ${w.line})` : ""}
                  </div>
                </div>
                <Badge tone={w.code === "SECURITY_EVAL" ? "failed" : "healed"}>
                  {w.code === "SECURITY_EVAL" ? "Security" : "Lint"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual Dependency Graph (FR-P5) */}
      <div className="surface-card flex flex-col p-5">
        <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-accent" aria-hidden />
            <h3 className="text-sm font-semibold text-fg">Cross-File Architecture Graph</h3>
          </div>
          <span className="text-xs text-muted">Linked dependencies & queries</span>
        </div>

        {/* Small SVG Architecture Graph using design tokens */}
        <div className="flex flex-wrap items-center justify-center gap-6 py-4">
          {connections.graphNodes.map((node) => {
            const tone =
              node.type === "html"
                ? "border-accent bg-accent/10"
                : node.type === "css"
                  ? "border-passed bg-passed/10"
                  : "border-flaky bg-flaky/10";
            const textTone =
              node.type === "html" ? "text-accent" : node.type === "css" ? "text-passed" : "text-flaky";

            return (
              <div
                key={node.id}
                className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center min-w-[160px] ${tone}`}
              >
                <span className={`text-xs font-bold uppercase tracking-wider ${textTone}`}>
                  {node.type}
                </span>
                <span className="mt-1 font-mono text-xs font-semibold text-fg">{node.label}</span>
                <span className="mt-1 text-[11px] text-muted">{node.stats}</span>
              </div>
            );
          })}
        </div>

        {/* Graph Edges Summary */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-muted border-t border-line pt-3">
          {connections.graphEdges.map((edge, idx) => (
            <div key={idx} className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1">
              <span className="font-mono text-fg">{edge.from}</span>
              <ArrowRight className="h-3 w-3 text-muted" aria-hidden />
              <span className="text-accent font-semibold">{edge.label} ({edge.count})</span>
              <ArrowRight className="h-3 w-3 text-muted" aria-hidden />
              <span className="font-mono text-fg">{edge.to}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cross-file Connection Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* CSS Selector Matches (FR-P5b) */}
        <div className="surface-card flex flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="text-xs font-semibold text-fg">CSS Selectors to HTML Matching</span>
            <div className="flex items-center gap-2">
              <Badge tone="passed">{connections.stats.matchedCssRules} matched</Badge>
              {connections.stats.unusedCssRules > 0 && (
                <Badge tone="healed">{connections.stats.unusedCssRules} unused</Badge>
              )}
            </div>
          </div>
          <div className="divide-y divide-line/40 max-h-80 overflow-y-auto p-2">
            {connections.cssMatches.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 py-2 px-3 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-medium text-fg truncate">{item.selector}</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Defined in <code className="text-accent">{item.cssFile}</code>
                    {item.note && <span className="text-healed italic ml-1">({item.note})</span>}
                  </p>
                </div>
                <Badge tone={item.status === "matched" ? "passed" : item.status === "not_evaluated" ? "flaky" : "healed"}>
                  {item.status === "matched" ? `${item.matchedCount} matches` : item.status === "not_evaluated" ? "Not Evaluated" : "Unused"}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* JS DOM Query Matches (FR-P5c) */}
        <div className="surface-card flex flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="text-xs font-semibold text-fg">JS DOM Queries to HTML Matching</span>
            <div className="flex items-center gap-2">
              <Badge tone="passed">
                {connections.jsMatches.filter((j) => j.status === "resolved").length} resolved
              </Badge>
              {connections.stats.unresolvedJsQueries > 0 && (
                <Badge tone="failed">{connections.stats.unresolvedJsQueries} unresolved</Badge>
              )}
            </div>
          </div>
          <div className="divide-y divide-line/40 max-h-80 overflow-y-auto p-2">
            {connections.jsMatches.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 py-2 px-3 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-medium text-fg truncate">{item.query}</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Queried from <code className="text-accent">{item.jsFile}</code>
                  </p>
                </div>
                <Badge tone={item.status === "resolved" ? "passed" : "failed"}>
                  {item.status === "resolved" ? `${item.matchedCount} elements` : "Unresolved"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
