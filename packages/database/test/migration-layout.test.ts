import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultMigrationDirectories, findWorkspaceRoot } from "../src/migration-layout.js";
import { inspectSqlMigrationLayout } from "../src/migrations.js";

describe("layout de migrations", () => {
  it("resolve a raiz a partir de pacote e encontra migrations reais em ordem", async () => {
    const workspaceRoot = findWorkspaceRoot();
    const directories = defaultMigrationDirectories(workspaceRoot);
    // A contagem e proposital: um numero magico aqui obriga decisao consciente
    // sempre que um modulo novo passa a ter migration. 11 = os 9 originais mais
    // merchandising (0013) e progression (0015).
    expect(directories).toHaveLength(11);
    expect(directories.every((directory) => existsSync(directory))).toBe(true);
    const migrations = await inspectSqlMigrationLayout(directories);
    expect(migrations.map((migration) => migration.migrationId)).toEqual([
      "0001_eventing.sql",
      "0002_audit.sql",
      "0003_identity.sql",
      "0004_iam.sql",
      "0005_sellers.sql",
      "0006_finance.sql",
      "0007_catalog.sql",
      "0008_catalog_authorization.sql",
      "0009_orders.sql",
      "0011_retention.sql",
      "0013_merchandising.sql",
      "0015_progression.sql",
    ]);
  });
});
