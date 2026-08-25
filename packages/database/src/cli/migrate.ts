import { createDatabase } from "../database.js";
import { runSqlMigrations } from "../migrations.js";
import { migrationDirectories } from "./migration-directories.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString?.startsWith("postgresql://")) {
  throw new Error("DATABASE_URL PostgreSQL é obrigatória para aplicar migrations reais.");
}
const database = createDatabase(connectionString, { max: 1 });
try {
  const result = await runSqlMigrations(database.pool, migrationDirectories);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await database.close();
}
