import { sql } from "drizzle-orm";
import type { Pool } from "pg";
import type { MidasTransaction } from "@midas/database";
import {
  createPublicId,
  parsePublicId,
  type ActorContext,
  type PublicId,
} from "@midas/kernel";
import { inboxReceipts, outboxEvents } from "./schema.js";

export type OutboxEventInput = {
  eventType: string;
  schemaVersion?: number;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  ownerModule: string;
  dataClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "FINANCIAL";
  payload: Record<string, unknown>;
  sellerAccountId?: string;
  occurredAt?: Date;
  causationId?: string;
};

export async function appendOutboxEvent(
  transaction: MidasTransaction,
  input: OutboxEventInput,
  actor: ActorContext,
): Promise<PublicId<"event">> {
  const eventId = createPublicId("event");
  await transaction.insert(outboxEvents).values({
    eventId: parsePublicId("event", eventId),
    eventType: input.eventType,
    schemaVersion: input.schemaVersion ?? 1,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    aggregateVersion: input.aggregateVersion,
    occurredAt: input.occurredAt ?? new Date(),
    correlationId: actor.correlationId,
    causationId: input.causationId,
    actorUserId: actor.actorUserId,
    sellerAccountId: input.sellerAccountId,
    ownerModule: input.ownerModule,
    dataClassification: input.dataClassification,
    payload: input.payload,
  });
  return eventId;
}

export async function recordInboxOnce(
  transaction: MidasTransaction,
  consumerId: string,
  eventId: string,
): Promise<boolean> {
  const inserted = await transaction
    .insert(inboxReceipts)
    .values({ consumerId, eventId: parsePublicId("event", eventId) })
    .onConflictDoNothing()
    .returning({ eventId: inboxReceipts.eventId });
  return inserted.length === 1;
}

export type LeasedOutboxEvent = {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  occurredAt: Date;
  recordedAt: Date;
  correlationId: string;
  causationId: string | null;
  actorUserId: string | null;
  sellerAccountId: string | null;
  ownerModule: string;
  dataClassification: string;
  payload: Record<string, unknown>;
};

export async function leaseOutboxBatch(
  pool: Pool,
  leaseOwner: string,
  limit = 50,
  leaseSeconds = 30,
): Promise<LeasedOutboxEvent[]> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<LeasedOutboxEvent>(
      `
        with candidates as (
          select event_id
          from eventing.outbox_events
          where publication_status = 'PENDING'
            and (lease_until is null or lease_until < clock_timestamp())
          order by recorded_at, event_id
          for update skip locked
          limit $1
        )
        update eventing.outbox_events as event
        set lease_owner = $2,
            lease_until = clock_timestamp() + make_interval(secs => $3),
            attempt_count = attempt_count + 1
        from candidates
        where event.event_id = candidates.event_id
        returning
          event.event_id as "eventId", event.event_type as "eventType",
          event.schema_version as "schemaVersion", event.aggregate_type as "aggregateType",
          event.aggregate_id as "aggregateId", event.aggregate_version as "aggregateVersion",
          event.occurred_at as "occurredAt", event.recorded_at as "recordedAt",
          event.correlation_id as "correlationId", event.causation_id as "causationId",
          event.actor_user_id as "actorUserId",
          event.seller_account_id as "sellerAccountId", event.owner_module as "ownerModule",
          event.data_classification as "dataClassification", event.payload
      `,
      [limit, leaseOwner, leaseSeconds],
    );
    await client.query("commit");
    return result.rows;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function markOutboxPublished(
  pool: Pool,
  eventId: string,
  leaseOwner: string,
): Promise<boolean> {
  const result = await pool.query(
    `update eventing.outbox_events
       set publication_status = 'PUBLISHED', published_at = clock_timestamp(),
           lease_owner = null, lease_until = null, last_error_code = null
     where event_id = $1 and lease_owner = $2 and publication_status = 'PENDING'`,
    [eventId, leaseOwner],
  );
  return result.rowCount === 1;
}

export async function releaseOutboxLease(
  pool: Pool,
  eventId: string,
  leaseOwner: string,
  errorCode: string,
): Promise<void> {
  await pool.query(
    `update eventing.outbox_events
       set lease_owner = null, lease_until = null, last_error_code = $3
     where event_id = $1 and lease_owner = $2 and publication_status = 'PENDING'`,
    [eventId, leaseOwner, errorCode.slice(0, 120)],
  );
}

export const pendingOutboxCountQuery = sql<number>`
  select count(*)::integer from eventing.outbox_events where publication_status = 'PENDING'
`;
