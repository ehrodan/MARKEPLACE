import { readdir } from "node:fs/promises";
import { basename } from "node:path";
import { migrationDirectories } from "./migration-directories.js";

const names: string[] = [];
for (const directory of migrationDirectories) {
  const entries = await readdir(directory, { withFileTypes: true });
  const sqlFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".sql"));
  if (sqlFiles.length === 0) throw new Error(`Módulo sem migration SQL: ${directory}`);
  names.push(...sqlFiles.map((entry) => basename(entry.name)));
}
const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
if (duplicates.length) throw new Error(`IDs de migration duplicados: ${duplicates.join(", ")}`);
const ordered = [...names].sort((left, right) => left.localeCompare(right));
if (ordered.some((name, index) => name !== names[index])) {
  throw new Error("Migrations dos módulos não estão em ordem global determinística.");
}
process.stdout.write(`${JSON.stringify({ migrationLayout: "VALID", migrations: ordered })}\n`);
