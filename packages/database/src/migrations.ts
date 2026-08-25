import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Pool } from "pg";

export type MigrationResult = {
  applied: string[];
  existing: string[];
};

export type SqlMigrationDescriptor = {
  migrationId: string;
  checksumSha256: string;
  path: string;
};

type LoadedSqlMigration = SqlMigrationDescriptor & { source: string };

async function listSqlFiles(directories: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const directory of directories) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".sql")) files.push(join(directory, entry.name));
    }
  }
  return files.sort((left, right) => basename(left).localeCompare(basename(right)));
}

async function loadSqlMigrations(directories: string[]): Promise<LoadedSqlMigration[]> {
  const migrations = await Promise.all(
    (await listSqlFiles(directories)).map(async (path) => {
      const source = await readFile(path, "utf8");
      return {
        migrationId: basename(path),
        checksumSha256: createHash("sha256").update(source).digest("hex"),
        path,
        source,
      };
    }),
  );
  const duplicateIds = migrations
    .map((migration) => migration.migrationId)
    .filter((migrationId, index, all) => all.indexOf(migrationId) !== index);
  if (duplicateIds.length > 0) {
    throw new Error(`IDs de migration duplicados: ${[...new Set(duplicateIds)].join(", ")}`);
  }
  return migrations;
}

export async function inspectSqlMigrationLayout(
  directories: string[],
): Promise<SqlMigrationDescriptor[]> {
  return (await loadSqlMigrations(directories)).map(
    ({ migrationId, checksumSha256, path }) => ({ migrationId, checksumSha256, path }),
  );
}

export async function runSqlMigrations(
  pool: Pool,
  directories: string[],
): Promise<MigrationResult> {
  const client = await pool.connect();
  const result: MigrationResult = { applied: [], existing: [] };
  try {
    await client.query("select pg_advisory_lock($1::bigint)", [7_741_903_251]);
    await client.query(`
      create schema if not exists midas_migrations;
      create table if not exists midas_migrations.schema_migrations (
        migration_id text primary key,
        checksum_sha256 char(64) not null,
        applied_at timestamptz not null default clock_timestamp()
      );
    `);

    for (const migration of await loadSqlMigrations(directories)) {
      const { migrationId, source } = migration;
      const checksum = migration.checksumSha256;
      const previous = await client.query<{ checksum_sha256: string }>(
        "select checksum_sha256 from midas_migrations.schema_migrations where migration_id = $1",
        [migrationId],
      );
      const appliedMigration = previous.rows[0];
      if (appliedMigration) {
        if (appliedMigration.checksum_sha256 !== checksum) {
          throw new Error(`Checksum divergente para migration já aplicada: ${migrationId}`);
        }
        result.existing.push(migrationId);
        continue;
      }

      await client.query("begin");
      try {
        await client.query(source);
        await client.query(
          "insert into midas_migrations.schema_migrations (migration_id, checksum_sha256) values ($1, $2)",
          [migrationId, checksum],
        );
        await client.query("commit");
        result.applied.push(migrationId);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    await client
      .query("select pg_advisory_unlock($1::bigint)", [7_741_903_251])
      .catch(() => undefined);
    client.release();
  }
  return result;
}
