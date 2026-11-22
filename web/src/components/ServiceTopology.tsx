import React from "react";
import { ClusterNode } from "./ServiceHealthBadge";

interface ServiceTopologyProps {
  nodes: ClusterNode[];
  onInjectSingle: (nodeId: string) => void;
  onRecoverSingle: (nodeId: string) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export function ServiceTopology({ nodes, onInjectSingle, onRecoverSingle, selectedNodeId, onSelectNode }: ServiceTopologyProps) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-4">
      <h3 className="text-sm font-semibold text-fg">Cluster Topology Overview</h3>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {nodes.map(n => (
          <div key={n.id} onClick={() => onSelectNode(n.id)} className="p-3 border rounded bg-surface-2 cursor-pointer">
            <span className="font-medium text-fg">{n.name}</span>
            <span className="text-xs text-muted block">Status: {n.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
