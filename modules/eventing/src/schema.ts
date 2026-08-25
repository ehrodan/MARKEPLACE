import {
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const eventingSchema = pgSchema("eventing");

export const outboxEvents = eventingSchema.table(
  "outbox_events",
  {
    eventId: uuid("event_id").primaryKey(),
    eventType: text("event_type").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    aggregateVersion: integer("aggregate_version").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    correlationId: text("correlation_id").notNull(),
    causationId: text("causation_id"),
    actorUserId: uuid("actor_user_id"),
    sellerAccountId: uuid("seller_account_id"),
    ownerModule: text("owner_module").notNull(),
    dataClassification: text("data_classification").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    publicationStatus: text("publication_status").notNull().default("PENDING"),
    attemptCount: integer("attempt_count").notNull().default(0),
    leaseOwner: text("lease_owner"),
    leaseUntil: timestamp("lease_until", { withTimezone: true, mode: "date" }),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    lastErrorCode: text("last_error_code"),
  },
  (table) => [
    uniqueIndex("outbox_events_aggregate_version_uidx").on(
      table.aggregateType,
      table.aggregateId,
      table.aggregateVersion,
      table.eventType,
    ),
    index("outbox_events_publication_status_recorded_at_idx").on(
      table.publicationStatus,
      table.recordedAt,
    ),
  ],
);

export const inboxReceipts = eventingSchema.table(
  "inbox_receipts",
  {
    consumerId: text("consumer_id").notNull(),
    eventId: uuid("event_id").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.consumerId, table.eventId] })],
);

export const idempotencyRecords = eventingSchema.table(
  "idempotency_records",
  {
    operationId: text("operation_id").notNull(),
    scopeHash: text("scope_hash").notNull(),
    idempotencyKeyHash: text("idempotency_key_hash").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.operationId, table.scopeHash, table.idempotencyKeyHash],
    }),
  ],
);
