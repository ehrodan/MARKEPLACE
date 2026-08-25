import {
  bigint,
  boolean,
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
import { users } from "@midas/identity";

export const retentionSchema = pgSchema("retention");

/**
 * Fronteira de modulo: `sourceCartId`, `listingId` e `catalogItemId` sao ids simples,
 * sem foreign key cruzada com `modules/orders` nem com `catalog.listings`. A ordem de
 * aplicacao das migrations em construcao paralela nao esta garantida. Ver o comentario
 * de cabecalho em `migrations/0011_retention.sql`.
 */

export const savedCarts = retentionSchema.table(
  "saved_carts",
  {
    savedCartId: uuid("saved_cart_id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    sourceCartId: uuid("source_cart_id").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull().default({}),
    itemCount: integer("item_count").notNull().default(0),
    subtotalMinor: bigint("subtotal_minor", { mode: "bigint" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    savedAt: timestamp("saved_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    recoveredAt: timestamp("recovered_at", { withTimezone: true, mode: "date" }),
    status: text("status").notNull().default("ACTIVE"),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("saved_carts_user_status_idx").on(table.userId, table.status, table.savedAt),
    index("saved_carts_expiry_idx").on(table.expiresAt),
  ],
);

export const watchlistEntries = retentionSchema.table(
  "watchlist_entries",
  {
    watchlistEntryId: uuid("watchlist_entry_id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    listingId: uuid("listing_id").notNull(),
    catalogItemId: uuid("catalog_item_id").notNull(),
    kind: text("kind").notNull(),
    targetPriceMinor: bigint("target_price_minor", { mode: "bigint" }),
    currency: char("currency", { length: 3 }).notNull(),
    referencePriceMinor: bigint("reference_price_minor", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true, mode: "date" }),
    status: text("status").notNull().default("ACTIVE"),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("watchlist_entries_user_listing_kind_uidx").on(
      table.userId,
      table.listingId,
      table.kind,
    ),
    index("watchlist_entries_user_status_idx").on(table.userId, table.status, table.createdAt),
    index("watchlist_entries_listing_active_idx").on(table.listingId, table.kind),
    index("watchlist_entries_item_idx").on(table.catalogItemId),
  ],
);

/**
 * Livro-razao append-only. Conceder e revogar sao sempre INSERT; nenhuma linha e
 * atualizada nem apagada. O estado corrente e a linha mais recente por `recordedAt`.
 */
export const reminderConsents = retentionSchema.table(
  "reminder_consents",
  {
    reminderConsentId: uuid("reminder_consent_id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    channel: text("channel").notNull(),
    purpose: text("purpose").notNull(),
    granted: boolean("granted").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    policyVersion: text("policy_version").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("reminder_consents_current_idx").on(
      table.userId,
      table.purpose,
      table.channel,
      table.recordedAt,
    ),
    index("reminder_consents_user_idx").on(table.userId, table.recordedAt),
  ],
);

/**
 * Toda tentativa de lembrete, enviada OU suprimida. A recusa tambem grava linha com
 * motivo nomeado -- e o que prova em auditoria que a politica foi aplicada.
 * O indice unico de `dedupeKey` e parcial (so linhas nao suprimidas) e vive apenas no SQL.
 */
export const reminderDispatches = retentionSchema.table(
  "reminder_dispatches",
  {
    reminderDispatchId: uuid("reminder_dispatch_id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    purpose: text("purpose").notNull(),
    channel: text("channel").notNull(),
    subjectRef: text("subject_ref"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: "date" }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    suppressedReason: text("suppressed_reason"),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("reminder_dispatches_user_created_idx").on(table.userId, table.createdAt),
    index("reminder_dispatches_pending_idx").on(table.scheduledFor),
    index("reminder_dispatches_user_purpose_sent_idx").on(
      table.userId,
      table.purpose,
      table.sentAt,
    ),
    index("reminder_dispatches_subject_idx").on(table.subjectRef, table.purpose),
  ],
);

/** Feed in-app: canal PULL, consultado pela propria pessoa. */
export const notifications = retentionSchema.table(
  "notifications",
  {
    notificationId: uuid("notification_id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    deepLink: text("deep_link"),
    relatedRef: text("related_ref"),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
    index("notifications_user_unread_idx").on(table.userId, table.readAt),
    index("notifications_kind_idx").on(table.kind, table.createdAt),
  ],
);

export type SavedCartRow = typeof savedCarts.$inferSelect;
export type WatchlistEntryRow = typeof watchlistEntries.$inferSelect;
export type ReminderConsentRow = typeof reminderConsents.$inferSelect;
export type ReminderDispatchRow = typeof reminderDispatches.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
