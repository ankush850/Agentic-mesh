import React from "react";
import { CheckCircle2, AlertTriangle, Flame } from "lucide-react";

export type LayerType = "Edge & Ingress" | "Core Microservices" | "Data & Queue";

export interface ClusterNode {
  id: string;
  name: string;
  layer: LayerType;
  port: number;
  status: "healthy" | "degraded" | "down";
  latencyMs?: number;
  crashCode?: string;
  crashType?: string;
  description?: string;
}

export function ServiceHealthBadge({ service, onInject }: { service: ClusterNode; onInject?: () => void }) {
  const isHealthy = service.status === "healthy";

  return (
    <div
      className={`group relative flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
        isHealthy
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
          : "border-rose-500/50 bg-rose-500/10 text-rose-300 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.15)]"
      }`}
    >
      <div className="flex items-center gap-2">
        {isHealthy ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
        )}
        <div>
          <span className="font-semibold text-fg">{service.name}</span>
          <span className="ml-1.5 font-mono text-[10px] text-muted">:{service.port}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
          isHealthy ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-300"
        }`}>
          {service.status}
        </span>

        {onInject && isHealthy && (
          <button
            onClick={onInject}
            title={`Inject crash into ${service.name}`}
            className="flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-400 opacity-80 transition-opacity hover:opacity-100 hover:bg-rose-500/30"
          >
            <Flame className="h-2.5 w-2.5" />
            Crash
          </button>
        )}
      </div>
    </div>
  );
}
