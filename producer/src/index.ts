import { Hono } from "hono";
import { cors } from "hono/cors";
import { taskRoutes } from "./routes/tasks";
import { closeDb } from "./db";
import { disconnectProducer } from "./kafka";

const PORT = Number(process.env.PORT || 3001);

const app = new Hono();

app.use("*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api/tasks", taskRoutes);

const server = Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`🚀 Producer API running on http://localhost:${PORT}`);

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    console.log(`Received ${sig}, shutting down…`);
    server.stop();
    await disconnectProducer();
    await closeDb();
    process.exit(0);
  });
}
