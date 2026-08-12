import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: false });

app.register(cors, { origin: true });

app.get("/health", async (request, reply) => {
  return { status: "healthy", service: "payment", uptime: process.uptime() };
});

app.post("/process-payment", async (request, reply) => {
  const body = request.body as { amount?: number; currency?: string } | undefined;
  return {
    transactionId: `tx_${Date.now()}`,
    status: "succeeded",
    amount: body?.amount || 99,
    currency: body?.currency || "USD"
  };
});

const port = Number(process.env.PORT || 3002);
app.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`[mock-payment] Service running at ${address}`);
});
