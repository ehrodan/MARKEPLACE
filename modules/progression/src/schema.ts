import {
  bigint,
  char,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const progressionSchema = pgSchema("progression");

/**
 * Espelho drizzle das tabelas de migrations/0015_progression.sql usadas pela
 * leitura canônica. Fronteira de módulo: `source_ref` é texto sem foreign key
 * cruzada com orders/finance (ver cabeçalho da migration). `amount_minor` usa
 * mode "number" porque o check do banco trava os valores em ±(2^53 - 1),
 * exatamente o intervalo seguro que `assertMinorBrl` exige no domínio.
 */

export const progressionContributions = progressionSchema.table(
  "progression_contributions",
  {
    contributionId: uuid("contribution_id").primaryKey(),
    subjectKind: text("subject_kind").notNull(),
    subjectRef: uuid("subject_ref").notNull(),
    sourceKind: text("source_kind").notNull(),
    sourceRef: text("source_ref").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    weightBp: integer("weight_bp").notNull().default(10_000),
    compensatesContributionId: uuid("compensates_contribution_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("progression_contributions_source_uidx").on(
      table.subjectKind,
      table.subjectRef,
      table.sourceKind,
      table.sourceRef,
    ),
    index("progression_contributions_subject_idx").on(
      table.subjectKind,
      table.subjectRef,
      table.occurredAt,
    ),
  ],
);

export const badgeDefinitions = progressionSchema.table("badge_definitions", {
  badgeCode: text("badge_code").primaryKey(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  criteria: jsonb("criteria").$type<Record<string, unknown>>().notNull().default({}),
  policyVersion: text("policy_version").notNull(),
  status: text("status").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const badgeAwards = progressionSchema.table(
  "badge_awards",
  {
    badgeAwardId: uuid("badge_award_id").primaryKey(),
    badgeCode: text("badge_code")
      .notNull()
      .references(() => badgeDefinitions.badgeCode),
    subjectKind: text("subject_kind").notNull(),
    subjectRef: uuid("subject_ref").notNull(),
    awardedAt: timestamp("awarded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    revokeReason: text("revoke_reason"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    uniqueIndex("badge_awards_subject_uidx").on(
      table.badgeCode,
      table.subjectKind,
      table.subjectRef,
    ),
  ],
);

export const rewardDefinitions = progressionSchema.table("reward_definitions", {
  rewardCode: text("reward_code").primaryKey(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  rewardKind: text("reward_kind").notNull(),
  terms: jsonb("terms").$type<Record<string, unknown>>().notNull().default({}),
  policyVersion: text("policy_version").notNull(),
  status: text("status").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const rewardAwards = progressionSchema.table(
  "reward_awards",
  {
    rewardAwardId: uuid("reward_award_id").primaryKey(),
    rewardCode: text("reward_code")
      .notNull()
      .references(() => rewardDefinitions.rewardCode),
    subjectKind: text("subject_kind").notNull(),
    subjectRef: uuid("subject_ref").notNull(),
    awardedAt: timestamp("awarded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    fulfillmentStatus: text("fulfillment_status").notNull().default("PENDING"),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true, mode: "date" }),
    failureReason: text("failure_reason"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index("reward_awards_subject_idx").on(table.subjectKind, table.subjectRef, table.awardedAt),
  ],
);
