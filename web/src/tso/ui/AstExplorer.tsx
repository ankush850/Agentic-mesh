/**
 * AST Explorer Component (FR-P1, FR-2.6).
 * Lazy-rendered tree with node inspection, syntax error highlighting,
 * and bi-directional synchronized source viewer highlighting.
 */

import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, AlertTriangle, Code, Terminal } from "lucide-react";
import type { Tree, SyntaxNode } from "../parse";
import { Badge } from "../../components/ui/Badge";
import { TSO_CONFIG } from "../config";

interface AstExplorerProps {
  tree: Tree;
  rawText: string;
  fileName: string;
}

interface TreeNodeProps {
  node: SyntaxNode;
  selectedNode: SyntaxNode | null;
  onSelectNode: (node: SyntaxNode) => void;
  depth?: number;
}

function TreeNodeItem({ node, selectedNode, onSelectNode, depth = 0 }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedNode === node;
  const isError = node.type === "ERROR" || node.type === "MISSING";

  return (
    <div className="select-none font-mono text-xs">
      <div
        onClick={() => onSelectNode(node)}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 cursor-pointer transition-colors ${
          isSelected
            ? "bg-accent/25 text-fg font-semibold"
            : isError
              ? "bg-failed/15 text-failed hover:bg-failed/25"
              : "hover:bg-surface-2 text-muted hover:text-fg"
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 text-muted hover:text-fg"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" aria-hidden />
            ) : (
              <ChevronRight className="h-3 w-3" aria-hidden />
            )}
          </button>
        ) : (
          <span className="w-3" />
        )}

        <span
          className={`font-semibold ${
            isError ? "text-failed" : node.named ? "text-accent" : "text-muted"
          }`}
        >
          {node.type}
        </span>

        <span className="text-[10px] text-muted">
          [{node.startPosition.row + 1}:{node.startPosition.column} - {node.endPosition.row + 1}:
          {node.endPosition.column}]
        </span>

        {node.text && (
          <span className="truncate max-w-[200px] text-[11px] text-fg/70">
            "{node.text.replace(/\s+/g, " ").trim().slice(0, 35)}"
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.slice(0, TSO_CONFIG.AST_PAGE_SIZE).map((child, idx) => (
            <TreeNodeItem
              key={idx}
              node={child}
              selectedNode={selectedNode}
              onSelectNode={onSelectNode}
              depth={depth + 1}
            />
          ))}
          {node.children.length > TSO_CONFIG.AST_PAGE_SIZE && (
            <div
              className="py-1 text-[11px] text-muted"
              style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }}
            >
              ...and {node.children.length - TSO_CONFIG.AST_PAGE_SIZE} more nodes
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AstExplorer({ tree, rawText, fileName }: AstExplorerProps) {
  const [selectedNode, setSelectedNode] = useState<SyntaxNode | null>(null);

  const errors = useMemo(
    () => tree.rootNode.descendants().filter((n) => n.type === "ERROR" || n.type === "MISSING"),
    [tree],
  );

  const lines = useMemo(() => rawText.split("\n"), [rawText]);

  // Determine line range to highlight in source viewer
  const highlightStartLine = selectedNode ? selectedNode.startPosition.row : -1;
  const highlightEndLine = selectedNode ? selectedNode.endPosition.row : -1;

  return (
    <div className="flex flex-col gap-4">
      {/* Syntax Error Notice if present (FR-P1) */}
      {errors.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-failed/40 bg-failed/10 p-4 text-xs text-failed">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="flex-1 space-y-1">
            <p className="font-semibold">
              Syntax Errors Detected ({errors.length} {errors.length === 1 ? "error" : "errors"}):
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              {errors.slice(0, 5).map((err, idx) => (
                <li key={idx}>
                  Line {err.startPosition.row + 1}:{err.startPosition.column} —{" "}
                  <code>{err.text.slice(0, 50).trim() || "<missing token>"}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Two-column layout: AST Tree on Left, Synchronized Source Viewer on Right */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left Column: AST Tree */}
        <div className="surface-card flex flex-col h-[520px]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-accent" aria-hidden />
              <span className="text-xs font-semibold text-fg">AST Node Tree</span>
              <Badge tone="queued">{tree.rootNode.descendants().length} nodes</Badge>
            </div>
            {selectedNode && (
              <span className="text-[11px] text-muted font-mono">
                Selected: {selectedNode.type}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <TreeNodeItem
              node={tree.rootNode}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
            />
          </div>
        </div>

        {/* Right Column: Source Viewer with synchronized range highlighting (FR-P1) */}
        <div className="surface-card flex flex-col h-[520px]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-accent" aria-hidden />
              <span className="text-xs font-semibold text-fg">Source Code Viewer</span>
              <span className="text-[11px] text-muted">({fileName})</span>
            </div>
            {selectedNode && (
              <span className="text-[11px] text-accent font-mono">
                Lines {selectedNode.startPosition.row + 1} - {selectedNode.endPosition.row + 1}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
            <pre className="text-fg">
              {lines.map((line, idx) => {
                const isHighlighted = idx >= highlightStartLine && idx <= highlightEndLine;
                return (
                  <div
                    key={idx}
                    className={`flex items-start px-2 py-0.5 rounded ${
                      isHighlighted ? "bg-accent/20 border-l-2 border-accent text-fg" : "text-fg/80"
                    }`}
                  >
                    <span className="w-10 shrink-0 select-none text-[11px] text-muted text-right pr-3">
                      {idx + 1}
                    </span>
                    <span className="flex-1 whitespace-pre-wrap break-all">{line || " "}</span>
                  </div>
                );
              })}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

