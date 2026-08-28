import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: false });

app.register(cors, { origin: true });

app.get("/health", async () => {
  return { status: "healthy", service: "auth", uptime: process.uptime() };
});

app.post("/login", async (request, reply) => {
  const body = request.body as { username?: string; password?: string } | undefined;
  if (!body?.username || !body?.password) {
    return reply.status(400).send({ error: "Missing username or password" });
  }
  return {
    token: `jwt-mock-token-${Buffer.from(body.username).toString("base64")}`,
    user: { id: "usr_101", username: body.username, role: "developer" }
  };
});

app.post("/register", async (request, reply) => {
  const body = request.body as { username?: string } | undefined;
  if (!body?.username) {
    return reply.status(400).send({ error: "Username is required" });
  }
  return reply.status(201).send({
    message: "User registered successfully",
    userId: "usr_102"
  });
});

const PORT = 3001;
app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(`[Auth Service] Failed to start:`, err);
    process.exit(1);
  }
  console.log(`[Auth Service] Running on ${address}`);
});
