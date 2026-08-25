import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const prd = await readFile(resolve(root, 'docs/01-PRD-MIDAS.md'), 'utf8');
const requirements = await readFile(resolve(root, 'specs/midas-marketplace/requirements.md'), 'utf8');
const screens = await readFile(resolve(root, 'docs/07-MAPA-DE-TELAS-E-FLUXOS.md'), 'utf8');
const openApi = await readFile(resolve(root, 'packages/contracts/openapi/midas.openapi.yaml'), 'utf8');

function ids(source, expression) {
  return new Set([...source.matchAll(expression)].map((match) => match[0]));
}

const rfIds = ids(prd, /RF-\d{3}/g);
const rnfIds = ids(prd, /RNF-\d{3}/g);
const screenIds = ids(screens, /SCR-[A-Z]+-\d{3}/g);
const capabilityRequirements = ids(requirements, /^### Requisito \d+:/gm);
const operationIds = [...openApi.matchAll(/^\s+operationId:\s*([A-Za-z][A-Za-z0-9]+)\s*$/gm)].map((match) => match[1]);
const duplicateOperations = operationIds.filter((id, index) => operationIds.indexOf(id) !== index);

const errors = [];
if (rfIds.size !== 300) errors.push(`RF esperados=300 encontrados=${rfIds.size}`);
if (rnfIds.size !== 50) errors.push(`RNF esperados=50 encontrados=${rnfIds.size}`);
if (screenIds.size !== 95) errors.push(`SCR esperados=95 encontrados=${screenIds.size}`);
if (capabilityRequirements.size !== 35) errors.push(`requisitos de capability esperados=35 encontrados=${capabilityRequirements.size}`);
if (operationIds.length === 0) errors.push('OpenAPI sem operationId');
if (duplicateOperations.length > 0) errors.push(`operationId duplicado: ${[...new Set(duplicateOperations)].join(', ')}`);

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Rastreabilidade base válida: ${rfIds.size} RF, ${rnfIds.size} RNF, ${screenIds.size} SCR, ${capabilityRequirements.size} capabilities, ${operationIds.length} operations.`);
}
