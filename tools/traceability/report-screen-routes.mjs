import { readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const root = process.cwd();
const appDirectory = resolve(root, "apps/web/app");
const screenMapPath = resolve(root, "docs/07-MAPA-DE-TELAS-E-FLUXOS.md");
const strict = process.argv.includes("--strict");
const strictFunctional = process.argv.includes("--functional");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return nested.flat();
}

function routeFromPage(file) {
  const local = relative(appDirectory, file).split(sep).join("/");
  const directory = local.replace(/(?:^|\/)page\.tsx$/, "");
  const segments = directory
    .split("/")
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")))
    .map((segment) => {
      if (/^\[\[\.\.\..+\]\]$/.test(segment)) return "**";
      if (/^\[\.\.\..+\]$/.test(segment)) return "*";
      if (/^\[.+\]$/.test(segment)) return `:${segment.slice(1, -1)}`;
      return segment;
    });
  return `/${segments.join("/")}`;
}

function routeExpression(pattern) {
  const normalized = pattern
    .replace(/\[\/:([A-Za-z][A-Za-z0-9]*)\]/g, "(?:/:$1)?")
    .replace(/\[\/:([A-Za-z][A-Za-z0-9]*)\]/g, "(?:/:$1)?");
  const pieces = normalized.split("/").filter(Boolean).map((piece) => {
    if (piece === "**") return "(?:/.*)?";
    if (piece === "*") return "/.+";
    if (piece.startsWith("(?:")) return piece.replace(/^\(\?:/, "(?:/");
    if (piece.startsWith(":")) return "/[^/]+";
    return `/${piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
  });
  return new RegExp(`^${pieces.join("") || "/"}$`);
}

function matchingPages(documentedRoute, applicationPages) {
  const optionalMatch = documentedRoute.match(/^(.*)\[\/(.+)\]$/);
  const candidates = optionalMatch
    ? [optionalMatch[1] || "/", `${optionalMatch[1]}/${optionalMatch[2]}`]
    : [documentedRoute];

  return candidates.map((candidate) => {
    const expected = routeExpression(candidate.replace(/:([A-Za-z][A-Za-z0-9]*)/g, ":param"));
    return applicationPages.filter(({ route }) => {
      if (route.includes("**")) {
        const prefix = route.slice(0, route.indexOf("**")).replace(/\/$/, "");
        return candidate === prefix || candidate.startsWith(`${prefix}/`);
      }
      return expected.test(route.replace(/:([A-Za-z][A-Za-z0-9]*)/g, "value"));
    });
  });
}

const screenMap = await readFile(screenMapPath, "utf8");
const screens = [...screenMap.matchAll(
  /^\|\s*(SCR-([A-Z]+)-\d{3})\s*\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|/gm,
)].map((match) => ({
  id: match[1],
  group: match[2],
  documentedStatus: match[3].trim(),
  route: match[4],
}));

const pageFiles = (await listFiles(appDirectory)).filter((file) => file.endsWith(`${sep}page.tsx`));
const applicationPages = await Promise.all(pageFiles.map(async (file) => ({
  file,
  route: routeFromPage(file),
  generatedContractSurface: (await readFile(file, "utf8")).includes(
    "GERADO por tools/traceability/generate-screen-contracts",
  ),
})));
const results = screens.map((screen) => {
  const matches = matchingPages(screen.route, applicationPages);
  return {
    ...screen,
    routePresent: matches.every((candidateMatches) => candidateMatches.length > 0),
    dedicatedSurface: matches.every((candidateMatches) =>
      candidateMatches.some((page) => !page.generatedContractSurface),
    ),
  };
});

for (const group of [...new Set(results.map((screen) => screen.group))]) {
  const rows = results.filter((screen) => screen.group === group);
  const present = rows.filter((screen) => screen.routePresent).length;
  const dedicated = rows.filter((screen) => screen.dedicatedSurface).length;
  console.log(`${group}: ${present}/${rows.length} rotas resolvíveis; ${dedicated}/${rows.length} superfícies dedicadas`);
  for (const screen of rows.filter((row) => !row.routePresent)) {
    console.log(`  AUSENTE ${screen.id} ${screen.route}`);
  }
}

const present = results.filter((screen) => screen.routePresent).length;
const missing = results.length - present;
const dedicated = results.filter((screen) => screen.dedicatedSurface).length;
const contractRequired = results.filter((screen) => screen.routePresent && !screen.dedicatedSurface).length;
console.log(`\nTOTAL: ${present}/${results.length} rotas resolvíveis; ${missing} ausentes.`);
console.log(`SUPERFÍCIES: ${dedicated}/${results.length} dedicadas; ${contractRequired} em CONTRACT_REQUIRED.`);
console.log("Nota: rota resolvível não comprova domínio, autorização, API ou teste E2E.");

if (screens.length !== 95) {
  console.error(`Mapa inválido: esperadas 95 telas, encontradas ${screens.length}.`);
  process.exitCode = 1;
} else if (strict && missing > 0) {
  process.exitCode = 1;
} else if (strictFunctional && (missing > 0 || contractRequired > 0)) {
  process.exitCode = 1;
}
