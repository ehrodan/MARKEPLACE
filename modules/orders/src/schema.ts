import {
  bigint,
  char,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { catalogItems, listings } from "@midas/catalog";
import { users } from "@midas/identity";
import { sellerAccounts } from "@midas/sellers";

export const ordersSchema = pgSchema("orders");

export const carts = ordersSchema.table("carts", {
  cartId: uuid("cart_id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId),
  status: text("status").notNull().default("ACTIVE"),
  currency: char("currency", { length: 3 }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const cartLines = ordersSchema.table("cart_lines", {
  cartLineId: uuid("cart_line_id").primaryKey(),
  cartId: uuid("cart_id")
    .notNull()
    .references(() => carts.cartId, { onDelete: "cascade" }),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listings.listingId),
  sellerAccountId: uuid("seller_account_id")
    .notNull()
    .references(() => sellerAccounts.sellerAccountId),
  quantity: integer("quantity").notNull(),
  unitPriceMinor: bigint("unit_price_minor", { mode: "bigint" }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  addedAt: timestamp("added_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  priceAsOf: timestamp("price_as_of", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const orders = ordersSchema.table("orders", {
  orderId: uuid("order_id").primaryKey(),
  publicCode: text("public_code").notNull().unique(),
  buyerUserId: uuid("buyer_user_id")
    .notNull()
    .references(() => users.userId),
  sellerAccountId: uuid("seller_account_id")
    .notNull()
    .references(() => sellerAccounts.sellerAccountId),
  status: text("status").notNull().default("PENDING_PAYMENT"),
  subtotalMinor: bigint("subtotal_minor", { mode: "bigint" }).notNull(),
  feeMinor: bigint("fee_minor", { mode: "bigint" }).notNull(),
  totalMinor: bigint("total_minor", { mode: "bigint" }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  reservedUntil: timestamp("reserved_until", { withTimezone: true, mode: "date" }),
  placedAt: timestamp("placed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
  cancelReason: text("cancel_reason"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const orderItems = ordersSchema.table("order_items", {
  orderItemId: uuid("order_item_id").primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.orderId, { onDelete: "cascade" }),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listings.listingId),
  catalogItemId: uuid("catalog_item_id")
    .notNull()
    .references(() => catalogItems.catalogItemId),
  quantity: integer("quantity").notNull(),
  unitPriceMinor: bigint("unit_price_minor", { mode: "bigint" }).notNull(),
  totalMinor: bigint("total_minor", { mode: "bigint" }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  listingSnapshot: jsonb("listing_snapshot").$type<Record<string, unknown>>().notNull().default({}),
});

export const orderEvents = ordersSchema.table("order_events", {
  orderEventId: uuid("order_event_id").primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.orderId, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  actorUserId: uuid("actor_user_id").references(() => users.userId),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const deliveries = ordersSchema.table("deliveries", {
  deliveryId: uuid("delivery_id").primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .unique()
    .references(() => orders.orderId, { onDelete: "cascade" }),
  status: text("status").notNull().default("PENDING"),
  buyerConfirmedAt: timestamp("buyer_confirmed_at", { withTimezone: true, mode: "date" }),
  sellerConfirmedAt: timestamp("seller_confirmed_at", { withTimezone: true, mode: "date" }),
  instructionRevealedAt: timestamp("instruction_revealed_at", {
    withTimezone: true,
    mode: "date",
  }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type CartRow = typeof carts.$inferSelect;
export type CartLineRow = typeof cartLines.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type OrderEventRow = typeof orderEvents.$inferSelect;
export type DeliveryRow = typeof deliveries.$inferSelect;
