import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { z } from "zod";
import { checkDatabase, createDatabase } from "@midas/database";
import { realtimeCapability } from "./capability.js";

const config = z
  .object({
    DATABASE_URL: z.url().startsWith("postgresql://"),
    REALTIME_HOST: z.string().default("127.0.0.1"),
    REALTIME_PORT: z.coerce.number().int().min(1).max(65_535).default(3_002),
  })
  .parse(process.env);
const database = createDatabase(config.DATABASE_URL, { max: 2 });
const app = Fastify({ logger: true, genReqId: () => randomUUID() });

app.get("/health/live", () => ({ status: "LIVE", process: "realtime" }));
app.get("/health/ready", async (_request, reply) => {
  try {
    await checkDatabase(database.pool);
    return {
      status: "READY",
      database: "AVAILABLE",
      capabilities: { chatGateway: realtimeCapability },
    };
  } catch {
    return reply.status(503).send({ status: "NOT_READY", database: "UNAVAILABLE" });
  }
});

async function shutdown(signal: string) {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await database.close();
}
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: config.REALTIME_HOST, port: config.REALTIME_PORT });
} catch (error) {
  app.log.error(error);
  await database.close();
  process.exitCode = 1;
}
