import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function findWorkspaceRoot(startDirectory = process.cwd()): string {
  let current = resolve(startDirectory);
  while (!existsSync(resolve(current, "pnpm-workspace.yaml"))) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`Raiz do workspace não encontrada a partir de ${startDirectory}`);
    }
    current = parent;
  }
  return current;
}

export function defaultMigrationDirectories(workspaceRoot = findWorkspaceRoot()): string[] {
  return [
    resolve(workspaceRoot, "modules/eventing/migrations"),
    resolve(workspaceRoot, "modules/administration-audit/migrations"),
    resolve(workspaceRoot, "modules/identity/migrations"),
    resolve(workspaceRoot, "modules/iam/migrations"),
    resolve(workspaceRoot, "modules/sellers/migrations"),
    resolve(workspaceRoot, "modules/finance/migrations"),
    resolve(workspaceRoot, "modules/catalog/migrations"),
    resolve(workspaceRoot, "modules/orders/migrations"),
    resolve(workspaceRoot, "modules/retention/migrations"),
    resolve(workspaceRoot, "modules/merchandising/migrations"),
    resolve(workspaceRoot, "modules/progression/migrations"),
  ];
}
