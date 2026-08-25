import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { z } from "zod";
import { EventContractError } from "@midas/contracts";
import { checkDatabase, createDatabase } from "@midas/database";
import {
  leaseOutboxBatch,
  markOutboxPublished,
  releaseOutboxLease,
} from "@midas/eventing";
import { outboxPublisherCapability } from "./capability.js";
import { publishOutboxEvent } from "./publisher.js";
import { createRetentionTriggerDependencies } from "./retention-trigger-adapters.js";
import { runRetentionTriggerCycle } from "./retention-trigger.js";

const config = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url().startsWith("postgresql://"),
    WORKER_HOST: z.string().default("127.0.0.1"),
    WORKER_PORT: z.coerce.number().int().min(1).max(65_535).default(3_003),
    OUTBOX_PUBLISH_URL: z.url().optional(),
    OUTBOX_PUBLISH_TOKEN: z.string().min(32).optional(),
    OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(1_000),
  })
  .superRefine((value, context) => {
    if (Boolean(value.OUTBOX_PUBLISH_URL) !== Boolean(value.OUTBOX_PUBLISH_TOKEN)) {
      context.addIssue({
        code: "custom",
        path: ["OUTBOX_PUBLISH_TOKEN"],
        message: "OUTBOX_PUBLISH_URL e OUTBOX_PUBLISH_TOKEN devem ser configurados juntos",
      });
    }
    if (
      value.NODE_ENV === "production" &&
      value.OUTBOX_PUBLISH_URL &&
      new URL(value.OUTBOX_PUBLISH_URL).protocol !== "https:"
    ) {
      context.addIssue({
        code: "custom",
        path: ["OUTBOX_PUBLISH_URL"],
        message: "OUTBOX_PUBLISH_URL deve usar HTTPS em produção",
      });
    }
  })
  .parse(process.env);
const database = createDatabase(config.DATABASE_URL, { max: 5 });
const app = Fastify({ logger: true, genReqId: () => randomUUID() });
const leaseOwner = `worker-${randomUUID()}`;
const publisherCapability = outboxPublisherCapability({
  nodeEnv: config.NODE_ENV,
  ...(config.OUTBOX_PUBLISH_URL ? { endpoint: config.OUTBOX_PUBLISH_URL } : {}),
  ...(config.OUTBOX_PUBLISH_TOKEN ? { token: config.OUTBOX_PUBLISH_TOKEN } : {}),
});
const retentionTriggerDependencies = createRetentionTriggerDependencies(database);
let cycleRunning = false;
let retentionCycleRunning = false;
let stopped = false;

app.get("/health/live", () => ({ status: "LIVE", process: "worker" }));
app.get("/health/ready", async (_request, reply) => {
  try {
    await checkDatabase(database.pool);
    return {
      status: "READY",
      database: "AVAILABLE",
      capabilities: {
        outboxPublisher: publisherCapability,
        // Só precisa do banco (consome o outbox internamente); disponível junto com ele.
        retentionTrigger: "AVAILABLE",
      },
    };
  } catch {
    return reply.status(503).send({ status: "NOT_READY", database: "UNAVAILABLE" });
  }
});

async function runCycle(): Promise<void> {
  if (
    cycleRunning ||
    stopped ||
    publisherCapability !== "AVAILABLE" ||
    !config.OUTBOX_PUBLISH_URL ||
    !config.OUTBOX_PUBLISH_TOKEN
  ) return;
  cycleRunning = true;
  try {
    const events = await leaseOutboxBatch(database.pool, leaseOwner);
    for (const event of events) {
      try {
        await publishOutboxEvent(config.OUTBOX_PUBLISH_URL, config.OUTBOX_PUBLISH_TOKEN, event);
        await markOutboxPublished(database.pool, event.eventId, leaseOwner);
      } catch (error) {
        app.log.error({ err: error, eventId: event.eventId }, "outbox publish failed");
        await releaseOutboxLease(
          database.pool,
          event.eventId,
          leaseOwner,
          error instanceof EventContractError ? error.code : "PUBLISH_FAILED",
        );
      }
    }
  } finally {
    cycleRunning = false;
  }
}

/**
 * Motor de triggers da watchlist: consome `catalog.listing.updated` do outbox e dispara os
 * avisos pedidos pela pessoa (preço caiu / voltou ao estoque) via política de retenção.
 * Independente do publicador HTTP — roda mesmo sem OUTBOX_PUBLISH_URL configurada.
 */
async function runRetentionCycle(): Promise<void> {
  if (retentionCycleRunning || stopped) return;
  retentionCycleRunning = true;
  try {
    const summary = await runRetentionTriggerCycle(retentionTriggerDependencies);
    if (summary.fetched > 0) {
      app.log.info(summary, "retention trigger cycle");
    }
  } catch (error) {
    app.log.error({ err: error }, "retention trigger cycle failed");
  } finally {
    retentionCycleRunning = false;
  }
}

const timer = setInterval(() => void runCycle(), config.OUTBOX_POLL_INTERVAL_MS);
timer.unref();
const retentionTimer = setInterval(
  () => void runRetentionCycle(),
  config.OUTBOX_POLL_INTERVAL_MS,
);
retentionTimer.unref();

async function shutdown(signal: string) {
  stopped = true;
  clearInterval(timer);
  clearInterval(retentionTimer);
  app.log.info({ signal }, "shutting down");
  await app.close();
  await database.close();
}
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: config.WORKER_HOST, port: config.WORKER_PORT });
} catch (error) {
  app.log.error(error);
  await database.close();
  process.exitCode = 1;
}
