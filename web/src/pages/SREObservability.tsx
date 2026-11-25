import React, { useState } from "react";
import { Flame, Layers, RotateCcw, Terminal } from "lucide-react";
import { ClusterNode, ServiceHealthBadge } from "../components/ServiceHealthBadge";
import { ServiceTopology } from "../components/ServiceTopology";
import { IncidentActionCard } from "../components/IncidentActionCard";
import { Button } from "../components/ui/Button";

const INITIAL_NODES: ClusterNode[] = [
  // Layer 1: Edge & Ingress
  {
    id: "api-gateway",
    name: "API Gateway",
    layer: "Edge & Ingress",
    port: 8080,
    status: "healthy",
    crashType: "HTTP 504 Gateway Timeout",
    description: "Reverse proxy routing traffic to microservices",
    crashCode: `// Simulating edge gateway socket hangup
export async function proxyHandler(req, res) {
  throw new GatewayTimeoutError("Connection to backend cluster timed out after 30000ms");
}`,
  },
  {
    id: "collector-daemon",
    name: "Go Log Collector",
    layer: "Edge & Ingress",
    port: 5141,
    status: "healthy",
    crashType: "TCP Ingestion Backpressure Overflow",
    description: "High-throughput Go goroutine log daemon with Redis Streams buffer",
    crashCode: `// Go stream buffer capacity exhaustion
func (c *Collector) BufferLog(e LogEvent) error {
  if len(c.channel) >= cap(c.channel) {
    panic("BufferOverflow: telemetry channel full (10000/10000) - dropped log")
  }
}`,
  },

  // Layer 2: Core Microservices
  {
    id: "auth-svc",
    name: "Auth Service",
    layer: "Core Microservices",
    port: 3001,
    status: "healthy",
    crashType: "JWT Key Rotation Verification Panic",
    description: "Issues and verifies access tokens and session permissions",
    crashCode: `// Auth token signing failure
export function verifySession(token: string) {
  if (!process.env.JWT_SECRET) {
    throw new CryptoKeyError("CRITICAL: Private RSA key missing during signature validation");
  }
}`,
  },
  {
    id: "payment-svc",
    name: "Payment Service",
    layer: "Core Microservices",
    port: 3002,
    status: "healthy",
    crashType: "500 PoolExhaustionError: DB Timeout",
    description: "Handles checkout transactions, ledger writes and refunds",
    crashCode: `// Simulating unhandled rejection & pool exhaustion
app.post("/process-payment", async (req, res) => {
  console.error("FATAL: Database connection pool exhausted on postgres-primary-cluster:5432");
  throw new PoolExhaustionError("ConnectionTimeout: pool limit 10 reached at Pool.connect()");
});`,
  },
  {
    id: "ingestion-svc",
    name: "Ingestion Service",
    layer: "Core Microservices",
    port: 3003,
    status: "healthy",
    crashType: "Heap Allocation Out-Of-Memory (OOM)",
    description: "Ingests raw telemetry batches into in-memory sliding buffer",
    crashCode: `// Simulating V8 heap allocation failure
export function ingestBatch(batch: any[]) {
  const oomLeaker = Buffer.alloc(1024 * 1024 * 1024); // 1GB memory exhaustion
  globalMemoryBank.push(oomLeaker);
}`,
  },

  // Layer 3: Data & Queue
  {
    id: "redis-broker",
    name: "Redis Streams Broker",
    layer: "Data & Queue",
    port: 6379,
    status: "healthy",
    crashType: "Consumer Group ACK Deadlock",
    description: "Redis Streams buffer with XADD and XREADGROUP guarantees",
    crashCode: `// Redis PEL pending entries list overflow
await redis.xgroup("CREATE", "telemetry:stream", "sentinelqa-cg", "$");
// Consumer group locked on unacknowledged messages (PEL > 50,000)`,
  },
  {
    id: "postgres-cluster",
    name: "PostgreSQL Primary",
    layer: "Data & Queue",
    port: 5432,
    status: "healthy",
    crashType: "Lock Contention & Deadlock 500",
    description: "Primary relational storage for tenant accounts and ledgers",
    crashCode: `// Postgres row lock deadlock detection
SELECT * FROM accounts WHERE id = 'usr_101' FOR UPDATE;
-- ERROR: deadlock detected between process 14210 and process 14219`,
  },
  {
    id: "pgvector-rag",
    name: "Supabase pgvector RAG",
    layer: "Data & Queue",
    port: 5433,
    status: "healthy",
    crashType: "Cosine RPC Match Latency Spike",
    description: "1536-dim vector store indexing historical incident remediations",
    crashCode: `// match_incidents RPC timeout
SELECT * FROM match_incidents(query_vector, 0.85, 5);
-- Query cancelled due to statement timeout (5000ms)`,
  },
];

export default function SREObservability() {
  const [nodes, setNodes] = useState<ClusterNode[]>(INITIAL_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("payment-svc");

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  // Inject chaos into a specific single node
  const handleInjectSingle = (nodeId: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, status: "degraded" } : n))
    );
    setSelectedNodeId(nodeId);
  };

  // Recover a specific single node
  const handleRecoverSingle = (nodeId: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, status: "healthy" } : n))
    );
  };

  // Inject chaos into all nodes of a specific layer
  const handleInjectLayer = (layerName: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.layer === layerName ? { ...n, status: "degraded" } : n))
    );
  };

  // Inject chaos simultaneously across the ENTIRE cluster (Cascading Multi-Layer Outage)
  const handleInjectFullCluster = () => {
    setNodes((prev) => prev.map((n) => ({ ...n, status: "degraded" })));
  };

  // Recover the entire cluster
  const handleRecoverAll = () => {
    setNodes((prev) => prev.map((n) => ({ ...n, status: "healthy" })));
  };

  return (
    <div className="space-y-6">
      {/* Header & Global Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">
            SRE Multi-Layer Observability & Cluster Chaos Engine
          </h2>
          <p className="text-xs text-muted">
            Inspect, inject, and autonomously remediate failures across Edge, Microservices, and Data tiers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleRecoverAll}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Recover All
          </Button>

          {/* Layer-by-Layer Injections */}
          <Button variant="secondary" size="sm" onClick={() => handleInjectLayer("Core Microservices")}>
            <Layers className="mr-1 h-3.5 w-3.5 text-accent" /> Crash Microservices Tier
          </Button>

          <Button variant="secondary" size="sm" onClick={() => handleInjectLayer("Data & Queue")}>
            <Layers className="mr-1 h-3.5 w-3.5 text-amber-400" /> Crash Data Tier
          </Button>

          {/* Simultaneous Cluster-Wide Crash */}
          <Button variant="danger" size="sm" onClick={handleInjectFullCluster}>
            <Flame className="mr-1 h-3.5 w-3.5" /> Inject Simultaneous Full Cluster Outage
          </Button>
        </div>
      </div>

      {/* Quick Status Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {nodes.slice(0, 4).map((node) => (
          <ServiceHealthBadge
            key={node.id}
            service={node}
            onInject={() => handleInjectSingle(node.id)}
          />
        ))}
      </div>

      {/* Big Interactive 3-Tier Topology Map */}
      <ServiceTopology
        nodes={nodes}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
        onInjectSingle={handleInjectSingle}
        onRecoverSingle={handleRecoverSingle}
      />

      {/* Active Incident & Code Inspection Card */}
      {selectedNode.status !== "healthy" ? (
        <IncidentActionCard
          service={selectedNode.name}
          symptom={`${selectedNode.crashType} encountered on port ${selectedNode.port}`}
          rootCause={`LangGraph RCA: Unhandled exception and dependency failure detected in tier "${selectedNode.layer}".`}
          proposedAction={`Rollback container image tag from sentinelqa/${selectedNode.id}:v2.1 to verified stable tag :v2.0`}
          targetImage={`sentinelqa/${selectedNode.id}:v2.1`}
          stableImage={`sentinelqa/${selectedNode.id}:v2.0`}
          filePath={`services/${selectedNode.id}/routes.ts`}
          lineNo={42}
          failingCodeSnippet={selectedNode.crashCode}
          onApproveRollback={async () => {
            await new Promise((r) => setTimeout(r, 800));
            handleRecoverSingle(selectedNode.id);
          }}
          onDismiss={() => handleRecoverSingle(selectedNode.id)}
        />
      ) : (
        /* Code Inspection Viewer for selected healthy node */
        <div className="rounded-xl border border-line bg-surface-1 p-5">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-accent" />
              <h4 className="text-xs font-bold text-fg uppercase tracking-wider">
                AST Code & Crash Blueprint: {selectedNode.name} (Port {selectedNode.port})
              </h4>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleInjectSingle(selectedNode.id)}
            >
              <Flame className="mr-1 h-3 w-3" />
              Inject Crash Into This Node
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted">
            {selectedNode.description}. Clicking &quot;Inject Crash Into This Node&quot; will simulate this failure blueprint:
          </p>

          <pre className="mt-3 overflow-x-auto rounded-lg border border-line/60 bg-black/60 p-3 font-mono text-[11px] text-emerald-400">
            {selectedNode.crashCode}
          </pre>
        </div>
      )}
    </div>
  );
}
