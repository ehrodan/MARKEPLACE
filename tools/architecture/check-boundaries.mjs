import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs']);
const forbiddenDomainDeclarations = /\b(?:class|interface|type)\s+(Tenant|SellerUser|BuyerUser|MasterUser|ListingDraft|PaymentIntent|AssetSubmission)\b/g;
const importPattern = /(?:from\s+|import\s+(?!type\b)|import\s*\(\s*)["']([^"']+)["']/g;

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.next', '.turbo', 'coverage'].includes(entry.name)) return [];
      return listFiles(path);
    }
    return [path];
  }));
  return nested.flat();
}

function extension(path) {
  const match = path.match(/\.[^.]+$/);
  return match?.[0] ?? '';
}

function moduleName(root, file) {
  const local = relative(resolve(root, 'modules'), file).split(sep);
  return local.length > 1 && local[0] !== '..' ? local[0] : undefined;
}

async function workspacePackages(root) {
  const packageFiles = (await listFiles(root)).filter((file) => file.endsWith(`${sep}package.json`) && !file.includes(`${sep}node_modules${sep}`));
  const packages = new Map();
  for (const file of packageFiles) {
    const manifest = JSON.parse(await readFile(file, 'utf8'));
    if (typeof manifest.name === 'string') {
      packages.set(manifest.name, { file, dependencies: { ...manifest.dependencies, ...manifest.devDependencies } });
    }
  }
  return packages;
}

function findCycles(packages) {
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  const path = [];

  function visit(name) {
    if (visiting.has(name)) {
      const start = path.indexOf(name);
      cycles.push([...path.slice(start), name]);
      return;
    }
    if (visited.has(name)) return;
    visiting.add(name);
    path.push(name);
    const pkg = packages.get(name);
    for (const dependency of Object.keys(pkg?.dependencies ?? {})) {
      if (packages.has(dependency)) visit(dependency);
    }
    path.pop();
    visiting.delete(name);
    visited.add(name);
  }

  for (const name of packages.keys()) visit(name);
  return cycles;
}

export async function checkWorkspace(root) {
  const errors = [];
  const files = (await listFiles(root)).filter((file) => {
    if (!sourceExtensions.has(extension(file))) return false;
    const workspacePath = relative(root, file).split(sep).join('/');
    return workspacePath !== 'tools/architecture/check-boundaries.test.mjs';
  });

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    for (const match of content.matchAll(forbiddenDomainDeclarations)) {
      errors.push(`${relative(root, file)}: declaracao canonica proibida ${match[1]}`);
    }

    const ownerModule = moduleName(root, file);
    if (!ownerModule) continue;
    for (const match of content.matchAll(importPattern)) {
      const specifier = match[1];
      if (specifier.startsWith('@midas/') && specifier.split('/').length > 2) {
        errors.push(`${relative(root, file)}: import interno de workspace ${specifier}`);
      }
      if (specifier.startsWith('.')) {
        const target = resolve(dirname(file), specifier);
        const targetModule = moduleName(root, target);
        if (targetModule && targetModule !== ownerModule) {
          errors.push(`${relative(root, file)}: import relativo cruza ${ownerModule} -> ${targetModule}`);
        }
      }
    }
  }

  const packages = await workspacePackages(root);
  for (const cycle of findCycles(packages)) {
    errors.push(`ciclo de pacotes: ${cycle.join(' -> ')}`);
  }
  return errors;
}

async function main() {
  const root = resolve(process.argv[2] ?? process.cwd());
  const errors = await checkWorkspace(root);
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('Fronteiras arquiteturais válidas.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
