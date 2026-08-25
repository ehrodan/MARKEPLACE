import {
  bigint,
  boolean,
  char,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sellerAccounts } from "@midas/sellers";

export const catalogSchema = pgSchema("catalog");

export const catalogItems = catalogSchema.table(
  "catalog_items",
  {
    catalogItemId: uuid("catalog_item_id").primaryKey(),
    publicSlug: text("public_slug").notNull().unique(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    gameOrigin: text("game_origin").notNull(),
    itemType: text("item_type").notNull(),
    rarity: text("rarity"),
    craftQuality: text("craft_quality"),
    metadata: jsonb("metadata").notNull().default({}),
    tombstonedAt: timestamp("tombstoned_at", { withTimezone: true, mode: "date" }),
    tombstoneReason: text("tombstone_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
);

export const catalogAssets = catalogSchema.table(
  "catalog_assets",
  {
    catalogAssetId: uuid("catalog_asset_id").primaryKey(),
    catalogItemId: uuid("catalog_item_id")
      .notNull()
      .references(() => catalogItems.catalogItemId, { onDelete: "cascade" }),
    assetType: text("asset_type").notNull(),
    storageUri: text("storage_uri").notNull(),
    storageProvider: text("storage_provider").notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "bigint" }).notNull(),
    mimeType: text("mime_type").notNull(),
    widthPixels: integer("width_pixels"),
    heightPixels: integer("height_pixels"),
    isPrimary: boolean("is_primary").notNull().default(false),
    approvalStatus: text("approval_status").notNull().default("PENDING"),
    approvedByUserId: uuid("approved_by_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    rejectionReason: text("rejection_reason"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
);

export const listingPlans = catalogSchema.table("listing_plans", {
  listingPlanId: uuid("listing_plan_id").primaryKey(),
  planCode: text("plan_code").notNull().unique(),
  displayName: text("display_name").notNull(),
  platformFeeRate: numeric("platform_fee_rate", { precision: 5, scale: 4 }).notNull(),
  pspFeeRate: numeric("psp_fee_rate", { precision: 5, scale: 4 }).notNull(),
  exposurePriority: integer("exposure_priority").notNull(),
  queuePriority: integer("queue_priority").notNull().default(0),
  benefits: jsonb("benefits").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const listings = catalogSchema.table(
  "listings",
  {
    listingId: uuid("listing_id").primaryKey(),
    publicSlug: text("public_slug").notNull().unique(),
    catalogItemId: uuid("catalog_item_id")
      .notNull()
      .references(() => catalogItems.catalogItemId),
    sellerAccountId: uuid("seller_account_id")
      .notNull()
      .references(() => sellerAccounts.sellerAccountId),
    listingPlanId: uuid("listing_plan_id")
      .notNull()
      .references(() => listingPlans.listingPlanId),
    listingStatus: text("listing_status").notNull().default("DRAFT"),
    priceMinor: bigint("price_minor", { mode: "bigint" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    quantityAvailable: integer("quantity_available").notNull().default(1),
    quantitySold: integer("quantity_sold").notNull().default(0),
    conditionNotes: text("condition_notes"),
    metadata: jsonb("metadata").notNull().default({}),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    pausedAt: timestamp("paused_at", { withTimezone: true, mode: "date" }),
    tombstonedAt: timestamp("tombstoned_at", { withTimezone: true, mode: "date" }),
    tombstoneReason: text("tombstone_reason"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
);

export const listingRevisions = catalogSchema.table(
  "listing_revisions",
  {
    listingRevisionId: uuid("listing_revision_id").primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.listingId, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    priceMinor: bigint("price_minor", { mode: "bigint" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    quantityAvailable: integer("quantity_available").notNull(),
    conditionNotes: text("condition_notes"),
    metadata: jsonb("metadata").notNull().default({}),
    changedByUserId: uuid("changed_by_user_id").notNull(),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("listing_revisions_number_uidx").on(table.listingId, table.revisionNumber),
  ],
);

export const listingCommercialSnapshots = catalogSchema.table(
  "listing_commercial_snapshots",
  {
    snapshotId: uuid("snapshot_id").primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.listingId),
    listingPlanId: uuid("listing_plan_id")
      .notNull()
      .references(() => listingPlans.listingPlanId),
    planCode: text("plan_code").notNull(),
    platformFeeRate: numeric("platform_fee_rate", { precision: 5, scale: 4 }).notNull(),
    pspFeeRate: numeric("psp_fee_rate", { precision: 5, scale: 4 }).notNull(),
    exposurePriority: integer("exposure_priority").notNull(),
    priceMinor: bigint("price_minor", { mode: "bigint" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    quantityAvailable: integer("quantity_available").notNull(),
    benefits: jsonb("benefits").notNull().default({}),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("listing_commercial_snapshots_listing_uidx").on(table.listingId)],
);

export const categories = catalogSchema.table("categories", {
  categoryId: uuid("category_id").primaryKey(),
  parentCategoryId: uuid("parent_category_id").references(
    (): AnyPgColumn => categories.categoryId,
  ),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const itemCategories = catalogSchema.table(
  "item_categories",
  {
    catalogItemId: uuid("catalog_item_id")
      .notNull()
      .references(() => catalogItems.catalogItemId, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.categoryId, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.catalogItemId, table.categoryId] })],
);
