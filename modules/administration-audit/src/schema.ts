import { jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const auditSchema = pgSchema("audit");

export const auditEvents = auditSchema.table("audit_events", {
  auditEventId: uuid("audit_event_id").primaryKey(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
  actorUserId: uuid("actor_user_id"),
  actingRole: text("acting_role"),
  sessionIdHash: text("session_id_hash"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id"),
  authorizationDecisionId: text("authorization_decision_id"),
  policyVersion: text("policy_version"),
  beforeRedacted: jsonb("before_redacted").$type<Record<string, unknown> | null>(),
  afterRedacted: jsonb("after_redacted").$type<Record<string, unknown> | null>(),
  reasonCode: text("reason_code"),
  correlationId: text("correlation_id").notNull(),
  ipPrefix: text("ip_prefix"),
  userAgentFamily: text("user_agent_family"),
  sellerAccountId: uuid("seller_account_id"),
  dataClassification: text("data_classification").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});
