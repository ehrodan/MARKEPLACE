import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

export type MidasDatabase = NodePgDatabase;
export type MidasTransaction = Parameters<
  Parameters<MidasDatabase["transaction"]>[0]
>[0];

export type DatabaseHandle = {
  pool: Pool;
  db: MidasDatabase;
  close(): Promise<void>;
};

export function createDatabase(
  connectionString: string,
  options: Pick<PoolConfig, "max" | "idleTimeoutMillis" | "connectionTimeoutMillis"> = {},
): DatabaseHandle {
  const pool = new Pool({
    connectionString,
    max: options.max ?? 10,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 30_000,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5_000,
    application_name: "midas",
  });
  const db = drizzle(pool, { casing: "snake_case" });

  return {
    pool,
    db,
    async close() {
      await pool.end();
    },
  };
}

export async function checkDatabase(pool: Pool): Promise<void> {
  await pool.query("select 1 as healthy");
}
