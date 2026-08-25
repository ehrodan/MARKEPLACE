import {
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const iamSchema = pgSchema("iam");

export const permissions = iamSchema.table("permissions", {
  permissionCode: text("permission_code").primaryKey(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const roles = iamSchema.table(
  "roles",
  {
    roleId: uuid("role_id").primaryKey(),
    roleCode: text("role_code").notNull(),
    roleScope: text("role_scope").notNull(),
    version: text("version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("roles_role_code_version_uidx").on(table.roleCode, table.version)],
);

export const rolePermissions = iamSchema.table(
  "role_permissions",
  {
    roleId: uuid("role_id").notNull(),
    permissionCode: text("permission_code").notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionCode] })],
);

export const userRoleAssignments = iamSchema.table(
  "user_role_assignments",
  {
    assignmentId: uuid("assignment_id").primaryKey(),
    userId: uuid("user_id").notNull(),
    roleId: uuid("role_id").notNull(),
    assignmentStatus: text("assignment_status").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true, mode: "date" }),
  },
);
