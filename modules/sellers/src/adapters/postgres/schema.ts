import { sql } from "drizzle-orm";
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
import { users } from "@midas/identity";
import { permissions } from "@midas/iam";

export const sellersSchema = pgSchema("sellers");

export const sellerAccounts = sellersSchema.table(
  "seller_accounts",
  {
    sellerAccountId: uuid("seller_account_id").primaryKey(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    accountType: text("account_type").notNull(),
    sellerAccountStatus: text("seller_account_status").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("seller_accounts_account_type_chk", sql`${table.accountType} in ('INDIVIDUAL','ORGANIZATION')`),
    check(
      "seller_accounts_status_chk",
      sql`${table.sellerAccountStatus} in ('ONBOARDING_REQUIRED','ACTIVE','SUSPENDED')`,
    ),
    check("seller_accounts_version_chk", sql`${table.version} > 0`),
  ],
);

export const sellerMemberships = sellersSchema.table(
  "seller_memberships",
  {
    sellerMembershipId: uuid("seller_membership_id").primaryKey(),
    sellerAccountId: uuid("seller_account_id")
      .notNull()
      .references(() => sellerAccounts.sellerAccountId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    membershipRole: text("membership_role").notNull(),
    membershipStatus: text("membership_status").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true, mode: "date" }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("seller_memberships_seller_account_id_user_id_active_uidx")
      .on(table.sellerAccountId, table.userId)
      .where(sql`${table.membershipStatus} = 'ACTIVE'`),
    index("seller_memberships_seller_account_id_status_idx").on(
      table.sellerAccountId,
      table.membershipStatus,
    ),
    index("seller_memberships_user_id_status_idx").on(table.userId, table.membershipStatus),
  ],
);

export const sellerMembershipGrants = sellersSchema.table(
  "seller_membership_grants",
  {
    grantId: uuid("grant_id").primaryKey(),
    sellerAccountId: uuid("seller_account_id")
      .notNull()
      .references(() => sellerAccounts.sellerAccountId),
    sellerMembershipId: uuid("seller_membership_id")
      .notNull()
      .references(() => sellerMemberships.sellerMembershipId),
    permissionCode: text("permission_code")
      .notNull()
      .references(() => permissions.permissionCode),
    effect: text("effect").notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("seller_membership_grants_membership_permission_uidx").on(
      table.sellerMembershipId,
      table.permissionCode,
    ),
    index("seller_membership_grants_seller_account_id_idx").on(table.sellerAccountId),
  ],
);
