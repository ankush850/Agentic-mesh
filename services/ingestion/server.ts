import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: false });

app.register(cors, { origin: true });

const inMemoryLogs: Array<{ id: string; timestamp: string; payload: unknown }> = [];

app.get("/health", async () => {
  return {
    status: "healthy",
    service: "ingestion",
    bufferedLogs: inMemoryLogs.length,
    uptime: process.uptime()
  };
});

app.post("/ingest", async (request, reply) => {
  const body = request.body;
  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    timestamp: new Date().toISOString(),
    payload: body
  };
  inMemoryLogs.push(entry);
  if (inMemoryLogs.length > 500) inMemoryLogs.shift(); // keep sliding buffer

  return reply.status(202).send({ accepted: true, logId: entry.id });
});

app.get("/logs", async () => {
  return { count: inMemoryLogs.length, logs: inMemoryLogs.slice(-50) };
});

const PORT = 3003;
app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(`[Ingestion Service] Failed to start:`, err);
    process.exit(1);
  }
  console.log(`[Ingestion Service] Running on ${address}`);
});
