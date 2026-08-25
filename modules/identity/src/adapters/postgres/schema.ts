import {
  check,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const identitySchema = pgSchema("identity");

export const users = identitySchema.table(
  "users",
  {
    userId: uuid("user_id").primaryKey(),
    emailNormalized: varchar("email_normalized", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    userStatus: text("user_status").notNull(),
    acceptedTermsVersion: varchar("accepted_terms_version", { length: 64 }).notNull(),
    acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true, mode: "date" }).notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_normalized_uidx").on(table.emailNormalized),
    check(
      "users_user_status_chk",
      sql`${table.userStatus} in ('PENDING_VERIFICATION','ACTIVE','SUSPENDED')`,
    ),
    check("users_version_chk", sql`${table.version} > 0`),
  ],
);

export const credentials = identitySchema.table(
  "credentials",
  {
    credentialId: uuid("credential_id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    credentialType: text("credential_type").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    retiredAt: timestamp("retired_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("credentials_user_id_credential_type_active_uidx")
      .on(table.userId, table.credentialType)
      .where(sql`${table.retiredAt} is null`),
  ],
);

export const emailVerificationChallenges = identitySchema.table(
  "email_verification_challenges",
  {
    challengeId: uuid("challenge_id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("email_verification_challenges_token_hash_uidx").on(table.tokenHash),
    index("email_verification_challenges_user_id_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const sessions = identitySchema.table(
  "sessions",
  {
    sessionId: uuid("session_id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_uidx").on(table.tokenHash),
    index("sessions_user_id_created_at_idx").on(table.userId, table.createdAt),
  ],
);

export const authRateLimits = identitySchema.table("auth_rate_limits", {
  rateLimitKeyHash: text("rate_limit_key_hash").primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true, mode: "date" }).notNull(),
  attemptCount: integer("attempt_count").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});
