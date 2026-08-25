import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const screenMapPath = resolve(root, "docs/07-MAPA-DE-TELAS-E-FLUXOS.md");
const contractOutput = resolve(root, "apps/web/lib/screen-contracts.generated.json");
const appDirectory = resolve(root, "apps/web/app");

const generatedHeader = `// GERADO por tools/traceability/generate-screen-contracts.mjs.\n// Fonte canônica: docs/07-MAPA-DE-TELAS-E-FLUXOS.md.\n`;

function readContracts(markdown) {
  return [...markdown.matchAll(
    /^\|\s*(SCR-([A-Z]+)-\d{3})\s*\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/gm,
  )].map((match) => ({
    id: match[1],
    group: match[2],
    documentedStatus: match[3].trim(),
    route: match[4].trim(),
    access: match[5].trim(),
    purpose: match[6].trim(),
    source: match[7].trim(),
    actions: match[8].trim(),
  }));
}

function expandRoute(route) {
  const optional = route.match(/^(.*)\[\/(.+)\]$/);
  if (!optional) return [route];
  return [optional[1] || "/", `${optional[1]}/${optional[2]}`];
}

function pagePath(route) {
  if (route === "/") return resolve(appDirectory, "page.tsx");
  const segments = route.split("/").filter(Boolean).map((segment) => {
    if (!segment.startsWith(":")) return segment;
    const name = segment.slice(1);
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
      throw new Error(`Parâmetro de rota inválido: ${segment}`);
    }
    return `[${name}]`;
  });
  return resolve(appDirectory, ...segments, "page.tsx");
}

async function exists(path) {
  return stat(path).then(() => true, () => false);
}

async function writeGeneratedPage(path, screenId) {
  if (await exists(path)) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${generatedHeader}import { ScreenContractPage } from "@/components/screen-contract/screen-contract-page";\n\nexport default function Page() {\n  return <ScreenContractPage screenId="${screenId}" />;\n}\n`,
    "utf8",
  );
  return true;
}

const markdown = await readFile(screenMapPath, "utf8");
const contracts = readContracts(markdown);
if (contracts.length !== 95) {
  throw new Error(`Mapa inválido: esperadas 95 telas, encontradas ${contracts.length}.`);
}
if (new Set(contracts.map((contract) => contract.id)).size !== contracts.length) {
  throw new Error("Mapa inválido: SCR-ID duplicado.");
}

await mkdir(dirname(contractOutput), { recursive: true });
await writeFile(contractOutput, `${JSON.stringify(contracts, null, 2)}\n`, "utf8");

let created = 0;
for (const contract of contracts) {
  for (const route of expandRoute(contract.route)) {
    created += Number(await writeGeneratedPage(pagePath(route), contract.id));
  }
}

console.log(`Contratos sincronizados: ${contracts.length}; páginas geradas agora: ${created}.`);
