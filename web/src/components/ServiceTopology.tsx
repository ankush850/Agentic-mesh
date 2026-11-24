import React from "react";
import { Server, ArrowDown, ShieldAlert, Cpu, Database, Globe, Network, Flame, RotateCcw } from "lucide-react";
import { ClusterNode, LayerType } from "./ServiceHealthBadge";

interface ServiceTopologyProps {
  nodes: ClusterNode[];
  onInjectSingle: (nodeId: string) => void;
  onRecoverSingle: (nodeId: string) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

const LAYERS: { title: LayerType; description: string; icon: React.ReactNode }[] = [
  {
    title: "Edge & Ingress",
    description: "Reverse Proxies, API Gateway & Go Telemetry Collector",
    icon: <Globe className="h-4 w-4 text-sky-400" />,
  },
  {
    title: "Core Microservices",
    description: "Business logic services communicating over virtual bridge",
    icon: <Server className="h-4 w-4 text-accent" />,
  },
  {
    title: "Data & Queue",
    description: "Distributed message queues, PostgreSQL cluster & Vector memory",
    icon: <Database className="h-4 w-4 text-amber-400" />,
  },
];

export function ServiceTopology({
  nodes,
  onInjectSingle,
  onRecoverSingle,
  selectedNodeId,
  onSelectNode,
}: ServiceTopologyProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface-1 p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-2.5">
          <Cpu className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-sm font-bold text-fg">Multi-Layer Microservice Cluster Topology</h3>
            <p className="text-[11px] text-muted">
              Interactive 3-tier architecture with per-node live chaos injection & AST inspection
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">
            <Network className="h-3 w-3 text-emerald-400" /> agenticmesh-bridge
          </span>
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] text-fg">
            {nodes.filter((n) => n.status === "healthy").length}/{nodes.length} Healthy
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {LAYERS.map((layer, layerIdx) => {
          const layerNodes = nodes.filter((n) => n.layer === layer.title);
          return (
            <div key={layer.title} className="space-y-3">
              {/* Layer Title */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {layer.icon}
                  <span className="text-xs font-bold uppercase tracking-wider text-fg">{layer.title}</span>
                  <span className="text-[11px] text-muted">— {layer.description}</span>
                </div>
                <span className="font-mono text-[10px] text-muted">Tier {layerIdx + 1}</span>
              </div>

              {/* Layer Nodes */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {layerNodes.map((node) => {
                  const isHealthy = node.status === "healthy";
                  const isSelected = selectedNodeId === node.id;

                  return (
                    <div
                      key={node.id}
                      onClick={() => onSelectNode(node.id)}
                      className={`cursor-pointer relative flex flex-col justify-between rounded-xl border p-4 transition-all ${
                        isSelected
                          ? "ring-2 ring-accent"
                          : ""
                      } ${
                        isHealthy
                          ? "border-line bg-surface-2/80 hover:border-line-strong hover:bg-surface-2"
                          : "border-rose-500/60 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.2)] animate-pulse"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                              isHealthy ? "bg-surface-3 text-accent" : "bg-rose-500/20 text-rose-400"
                            }`}
                          >
                            {isHealthy ? <Server className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-fg">{node.name}</p>
                            <p className="font-mono text-[10px] text-muted">Port {node.port}</p>
                          </div>
                        </div>

                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            isHealthy ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/30 text-rose-300 font-bold"
                          }`}
                        >
                          {node.status}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-[10px] text-muted">
                        <span>{node.crashType || "Normal Operation"}</span>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {isHealthy ? (
                            <button
                              onClick={() => onInjectSingle(node.id)}
                              className="flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 font-medium text-rose-400 transition-colors hover:bg-rose-500/30"
                            >
                              <Flame className="h-3 w-3" />
                              Inject /crash
                            </button>
                          ) : (
                            <button
                              onClick={() => onRecoverSingle(node.id)}
                              className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Rollback
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Layer Connector Arrow */}
              {layerIdx < LAYERS.length - 1 && (
                <div className="flex justify-center py-1 text-muted/40">
                  <ArrowDown className="h-4 w-4 animate-bounce" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
