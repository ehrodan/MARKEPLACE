import {
  createDatabase,
  defaultMigrationDirectories,
  runSqlMigrations,
} from "@midas/database";
import { loadApiConfig } from "./config.js";

const config = loadApiConfig();
const database = createDatabase(config.databaseUrl, { max: 1 });
try {
  const result = await runSqlMigrations(database.pool, defaultMigrationDirectories());
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await database.close();
}
