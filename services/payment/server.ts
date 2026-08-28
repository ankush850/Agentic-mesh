import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: false });

app.register(cors, { origin: true });

let isDegraded = false;

app.get("/health", async (request, reply) => {
  if (isDegraded) {
    return reply.status(503).send({
      status: "degraded",
      service: "payment",
      error: "Connection pool exhausted"
    });
  }
  return { status: "healthy", service: "payment", uptime: process.uptime() };
});

app.post("/process-payment", async (request, reply) => {
  if (isDegraded) {
    console.error("FATAL: Database connection pool exhausted on postgres-primary-cluster:5432");
    return reply.status(500).send({
      error: "PoolExhaustionError: ConnectionTimeout at Pool.connect() to postgres-primary-cluster:5432"
    });
  }

  const body = request.body as { amount?: number; currency?: string } | undefined;
  return {
    transactionId: `tx_${Date.now()}`,
    status: "succeeded",
    amount: body?.amount || 99,
    currency: body?.currency || "USD"
  };
});

// Chaos Injection Route
app.post("/crash", async (request, reply) => {
  isDegraded = true;
  console.error("CRITICAL [Chaos Injection]: Triggering PoolExhaustionError on postgres-primary-cluster:5432");
  console.error("Stack trace:\nPoolExhaustionError: ConnectionTimeout at Pool.connect (/app/services/payment/db.ts:42:15)\n    at QueryQueue.acquire (/app/services/payment/pool.ts:88:21)");
  
  return reply.status(500).send({
    error: "PoolExhaustionError: ConnectionTimeout at Pool.connect",
    message: "Cascading database failure injected",
    simulatedIncident: "INC-DATABASE-DEADLOCK-500"
  });
});

app.post("/reset", async () => {
  isDegraded = false;
  console.log("[Payment Service] Service restored to healthy state.");
  return { status: "reset", message: "Database pool recovered" };
});

const PORT = 3002;
app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(`[Payment Service] Failed to start:`, err);
    process.exit(1);
  }
  console.log(`[Payment Service] Running on ${address}`);
});
