import { checkDatabase, createDatabase } from "../database.js";
import { inspectSqlMigrationLayout } from "../migrations.js";
import { migrationDirectories } from "./migration-directories.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString?.startsWith("postgresql://")) {
  throw new Error("DATABASE_URL PostgreSQL é obrigatória para o health check real.");
}
const database = createDatabase(connectionString, { max: 1 });
try {
  await checkDatabase(database.pool);
  const expected = await inspectSqlMigrationLayout(migrationDirectories);
  const migrationTable = await database.pool.query<{ relation: string | null }>(
    "select to_regclass('midas_migrations.schema_migrations')::text as relation",
  );
  if (!migrationTable.rows[0]?.relation) {
    process.stdout.write(
      `${JSON.stringify({
        database: "AVAILABLE",
        migrationState: "UNINITIALIZED",
        expectedMigrations: expected.map((migration) => migration.migrationId),
      })}\n`,
    );
  } else {
    const migrations = await database.pool.query<{
      migration_id: string;
      checksum_sha256: string;
    }>(
      `select migration_id, checksum_sha256
         from midas_migrations.schema_migrations
        order by migration_id`,
    );
    const appliedById = new Map(
      migrations.rows.map((migration) => [migration.migration_id, migration.checksum_sha256]),
    );
    const missing = expected.filter((migration) => !appliedById.has(migration.migrationId));
    const divergent = expected.filter(
      (migration) => appliedById.get(migration.migrationId) !== migration.checksumSha256,
    );
    const expectedIds = new Set(expected.map((migration) => migration.migrationId));
    const unknown = migrations.rows.filter(
      (migration) => !expectedIds.has(migration.migration_id),
    );
    if (missing.length > 0 || divergent.length > 0 || unknown.length > 0) {
      throw new Error(
        `Estado de migrations divergente: missing=${missing.map((item) => item.migrationId).join(",") || "none"} ` +
          `checksum=${divergent.map((item) => item.migrationId).join(",") || "none"} ` +
          `unknown=${unknown.map((item) => item.migration_id).join(",") || "none"}`,
      );
    }
    process.stdout.write(
      `${JSON.stringify({
        database: "AVAILABLE",
        migrationState: "CURRENT",
        migrations: migrations.rows.map((row) => row.migration_id),
      })}\n`,
    );
  }
} finally {
  await database.close();
}
